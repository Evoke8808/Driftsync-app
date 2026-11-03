// "My assigned courses": courses on a job seeker's list.
// A course gets on the list in two ways: the AI plan (Learning Pathway) suggests it, or a counsellor
// recommends it personally. Either way the person has to accept it before it counts as assigned.
const cds = require('@sap/cds');
const lib = require('./agents/lib');

const TABLE = 'skillsetu_AssignedCourses';
const STATUSES = ['suggested', 'accepted', 'declined', 'done'];

// Lets the new table appear without "cds deploy" (which would wipe the accounts people made).
async function ensureTable() {
  const db = await cds.connect.to('db');
  if (!/sqlite/.test(db.options?.kind || db.kind || '') && !/sqlite/.test(db.options?.impl || '')) return;
  const found = await db.run(`SELECT name FROM sqlite_master WHERE type='table' AND name='${TABLE}'`);
  if (found.length) return;
  const ddl = [].concat(cds.compile.to.sql(await cds.load(require('path').join(cds.root, 'db', 'schema')))).find((s) => new RegExp(`^CREATE TABLE ${TABLE}\\b`).test(s));
  if (ddl) { await db.run(ddl); cds.log('courses').info('created table', TABLE); }
}

async function nextSeq(entity, caseID) {
  const r = await SELECT.one.from(entity).columns('max(seq) as m').where({ caseFile_ID: caseID });
  return (r?.m ?? 0) + 1;
}

// Keep the AI suggestions in step with each case's current plan.
async function syncAI(cases) {
  const { AssignedCourses, Courses } = lib.db();
  for (const cf of cases) {
    const plan = lib.parse(cf.plan, null);
    const rows = await SELECT.from(AssignedCourses).where({ caseFile_ID: cf.ID });
    const wanted = [];
    for (const s of plan?.steps || []) {
      const c = await SELECT.one.from(Courses).columns('ID').where({ title: s.course.title, provider: s.course.provider });
      if (c) wanted.push({ courseID: c.ID, skill: s.skill });
    }
    const add = wanted.filter((w) => !rows.some((r) => r.course_ID === w.courseID));
    if (add.length) await INSERT.into(AssignedCourses).entries(add.map((w) => ({ caseFile_ID: cf.ID, owner: cf.owner || null, course_ID: w.courseID,
      source: 'ai', assignedBy: 'SkillSetu AI', note: plan.roleTitle ? `Part of your plan for ${plan.roleTitle}` : null, skill: w.skill, status: 'suggested' })));
    // A plan for a new role drops the old AI suggestions the person never answered.
    const stale = rows.filter((r) => r.source === 'ai' && r.status === 'suggested' && !wanted.some((w) => w.courseID === r.course_ID)).map((r) => r.ID);
    if (stale.length) await DELETE.from(AssignedCourses).where({ ID: { in: stale } });
  }
}

async function list(caseIDs) {
  if (!caseIDs.length) return [];
  const { AssignedCourses, CaseFiles } = lib.db();
  const cases = await SELECT.from(CaseFiles).columns('ID', 'owner', 'plan').where({ ID: { in: caseIDs } });
  await syncAI(cases);
  const rows = await SELECT.from(AssignedCourses, (a) => { a('*'), a.course((c) => { c('*'), c.skill((s) => s('name')); }); })
    .where({ caseFile_ID: { in: caseIDs } }).orderBy('createdAt desc');
  return rows.map((r) => ({ ID: r.ID, caseID: r.caseFile_ID, code: lib.caseCode(r.caseFile_ID), status: r.status, source: r.source,
    assignedBy: r.assignedBy, note: r.note, skill: r.skill || r.course?.skill?.name || null, at: r.createdAt, changedAt: r.modifiedAt,
    course: r.course && { ID: r.course.ID, title: r.course.title, provider: r.course.provider, url: r.course.url, duration: r.course.duration, level: r.course.level } }));
}

// The person answers a suggestion: accept, decline, or mark an accepted course done.
async function respond({ id, decision }) {
  const { AssignedCourses, Courses, AuditLog } = lib.db();
  const status = { accept: 'accepted', decline: 'declined', done: 'done' }[decision];
  if (!status) return { error: 400, message: 'decision must be accept, decline or done' };
  const row = await SELECT.one.from(AssignedCourses).where({ ID: id });
  if (!row) return { error: 404, message: 'Course not found on your list' };
  await UPDATE(AssignedCourses, id).with({ status });
  const c = await SELECT.one.from(Courses).columns('title').where({ ID: row.course_ID });
  const verb = { accepted: 'accepted', declined: 'said no to', done: 'finished' }[status];
  await INSERT.into(AuditLog).entries({ caseFile_ID: row.caseFile_ID, seq: await nextSeq(AuditLog, row.caseFile_ID), agent: 'human', routedBy: '-',
    reason: `Person ${verb} the course "${c?.title}" (${row.source === 'ai' ? 'suggested by the AI plan' : 'recommended by ' + row.assignedBy})`, provider: 'person', model: null, ms: 0 });
  return { ID: id, status };
}

// A counsellor adds a personal recommendation. It lands in the person's chat and course list.
async function recommend({ caseID, courseID, note, by }) {
  const { AssignedCourses, Courses, CaseFiles, ChatMessages, AuditLog } = lib.db();
  const cf = await SELECT.one.from(CaseFiles).columns('ID', 'owner').where({ ID: caseID });
  if (!cf) return { error: 404, message: 'Case not found' };
  const c = await SELECT.one.from(Courses, (x) => { x('*'), x.skill((s) => s('name')); }).where({ ID: courseID });
  if (!c) return { error: 404, message: 'Course not found' };
  const clean = String(note || '').trim().slice(0, 500) || null;
  const who = by ? `${by.name} (${by.username})` : 'Counsellor';
  const existing = await SELECT.one.from(AssignedCourses).where({ caseFile_ID: caseID, course_ID: courseID });
  const fields = { source: 'counsellor', assignedBy: who, note: clean, skill: c.skill?.name || null };
  if (existing) await UPDATE(AssignedCourses, existing.ID).with(existing.status === 'declined' ? { ...fields, status: 'suggested' } : fields);
  else await INSERT.into(AssignedCourses).entries({ caseFile_ID: caseID, owner: cf.owner || null, course_ID: courseID, status: 'suggested', ...fields });
  const name = by ? `Your counsellor ${by.name}` : 'Your counsellor';
  await INSERT.into(ChatMessages).entries({ caseFile_ID: caseID, seq: await nextSeq(ChatMessages, caseID), role: 'counsellor', agent: 'human',
    text: `${name} recommends a course for you: ${c.title} (${c.provider}, ${c.duration}).${clean ? ' Note: ' + clean : ''}`,
    card: JSON.stringify({ type: 'courseRec', by: by?.name || null, note: clean, course: { title: c.title, provider: c.provider, duration: c.duration, url: c.url, skill: c.skill?.name || null } }) });
  await INSERT.into(AuditLog).entries({ caseFile_ID: caseID, seq: await nextSeq(AuditLog, caseID), agent: 'human', routedBy: '-',
    reason: `Counsellor ${who} recommended the course "${c.title}"${clean ? ': ' + clean : ''}`, provider: 'person', model: null, ms: 0 });
  return { ok: true, course: c.title };
}

// A counsellor takes back a recommendation the person has not answered yet.
async function withdraw({ id }) {
  const { AssignedCourses } = lib.db();
  const row = await SELECT.one.from(AssignedCourses).where({ ID: id });
  if (!row) return { error: 404, message: 'Not found' };
  if (row.source !== 'counsellor' || row.status !== 'suggested') return { error: 409, message: 'Only an unanswered counsellor recommendation can be withdrawn' };
  await DELETE.from(AssignedCourses).where({ ID: id });
  return { ok: true };
}

module.exports = { ensureTable, list, respond, recommend, withdraw, STATUSES };
