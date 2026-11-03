// The watch: SkillSetu keeps working for people after the chat ends. For every watched case it looks for
//  1. due check-ins after a hire (day 7, 30, 90),
//  2. a rise in their current job's automation risk (with the safest move inside their company),
//  3. a clearly better job they already qualify for (more pay, same or lower risk).
// Each finding becomes a chat message, an outbox email (demo: not sent) and a webhook event.
// Runs on a timer in the server, and on demand from the counsellor desk (days = jump ahead in time for a demo).
const cds = require('@sap/cds');
const { db, catalog, matchRoles, parse, label, caseCode, RISK_RANK, salaryTop, today, daysBetween } = require('./lib');
const { CHECKINS, nextSteps } = require('./after-hire');
const { queue } = require('./outbox');
const { emit } = require('../integrations/webhooks');

const LOG = cds.log('watch');
const GOOD_MATCH = 75;

function findAlerts(cf, cat, now) {
  const w = cf.watch, seen = new Set(w.alerted || []);
  const names = cf.skills.map((s) => s.skill);
  const hi = /[ऀ-ॿ]/.test(String(cf.story || '').slice(-300));
  const job = cf.profile.job && cat.roles.find((r) => r.ID === cf.profile.job.roleID);
  const out = [];

  // 1. Check-ins after a hire.
  if (w.hiredAt && job) {
    const age = daysBetween(w.hiredAt, now);
    for (const c of CHECKINS) {
      if (age < c.day || seen.has('checkin:' + c.day)) continue;
      const step = c.day === 90 ? nextSteps(names, job, cat)[0] : null;
      out.push({ key: 'checkin:' + c.day, kind: 'checkin', agent: 'growth',
        subject: `Day ${c.day} check-in: how is ${job.title} going?`,
        text: (hi ? c.hi : c.en) + (step ? (hi ? ` अगला कदम: ${step.title} (${step.salary})${step.missing.length ? `, ${step.missing.map(label).join(', ')} सीखकर` : ''}।` : ` Next step: ${step.title} (${step.salary})${step.missing.length ? `, after ${step.missing.map(label).join(', ')} (about ${step.hours} hours)` : ''}.`) : ''),
        roleID: step?.ID || null });
    }
  }

  // 2. Their job got riskier since we last looked (the catalog is updated as automation spreads).
  if (job && w.riskSeen && RISK_RANK[job.automationRisk] > RISK_RANK[w.riskSeen] && !seen.has(`risk:${job.ID}:${job.automationRisk}`)) {
    const inside = matchRoles(names, cat).filter((m) => m.role.company === job.company && m.role.ID !== job.ID && RISK_RANK[m.role.automationRisk] < RISK_RANK[job.automationRisk])
      .sort((a, b) => b.matchPercent - a.matchPercent)[0];
    out.push({ key: `risk:${job.ID}:${job.automationRisk}`, kind: 'risk', agent: 'shield',
      subject: `Heads-up: ${job.title} is now ${job.automationRisk.toLowerCase()} automation risk`,
      text: hi ? `ध्यान दें: ${job.title} में ऑटोमेशन का खतरा बढ़ गया है।${inside ? ` आपकी कंपनी में ${inside.role.title} ज़्यादा सुरक्षित है (${inside.matchPercent}% मेल)।` : ''}`
        : `Heads-up: automation risk for ${job.title} went up to ${job.automationRisk}.${inside ? ` ${inside.role.title} inside ${job.company} is safer, and you match ${inside.matchPercent}%.` : ''}`,
      roleID: inside?.role.ID || null });
    w.riskSeen = job.automationRisk;
  }

  // 3. A clearly better job they already qualify for.
  const better = matchRoles(names, cat).filter((m) => m.matchPercent >= GOOD_MATCH && m.role.ID !== job?.ID && !seen.has('match:' + m.role.ID) && (!job
      || (salaryTop(m.role.salary) > salaryTop(job.salary) && RISK_RANK[m.role.automationRisk] <= RISK_RANK[job.automationRisk])
      // A safer job counts as better only if it doesn't pay less, unless today's job is at high risk.
      || (RISK_RANK[m.role.automationRisk] < RISK_RANK[job.automationRisk] && (job.automationRisk === 'High' || salaryTop(m.role.salary) >= salaryTop(job.salary)))))
    .sort((a, b) => (b.role.company === job?.company) - (a.role.company === job?.company) || b.matchPercent - a.matchPercent || salaryTop(b.role.salary) - salaryTop(a.role.salary))[0];
  if (better) {
    const r = better.role, inside = job && r.company === job.company;
    out.push({ key: 'match:' + r.ID, kind: 'match', agent: 'growth',
      subject: `A better match for you: ${r.title} (${r.salary})`,
      text: hi ? `आपके लिए बेहतर नौकरी: ${r.title}, ${r.company}${inside ? ' (आपकी अपनी कंपनी)' : ''}, ${r.salary}, ${better.matchPercent}% मेल, ऑटोमेशन खतरा ${r.automationRisk}।`
        : `A better match for you: ${r.title} at ${r.company}${inside ? ' (your own company)' : ''}, ${r.salary}, ${better.matchPercent}% skills match, ${r.automationRisk.toLowerCase()} automation risk.`,
      roleID: r.ID });
  }
  return out;
}

async function runWatch({ days = 0 } = {}) {
  const { CaseFiles, ChatMessages } = db();
  const cat = await catalog();
  const now = today(Math.max(0, Math.min(365, +days || 0)));
  const rows = (await SELECT.from(CaseFiles)).filter((r) => parse(r.watch, null)?.on);
  const alerts = [];
  for (const row of rows) {
    const cf = { ...row, skills: parse(row.skills, []), profile: parse(row.profile, {}), watch: parse(row.watch, {}) };
    cf.watch.alerted = cf.watch.alerted || [];
    const found = findAlerts(cf, cat, now);
    if (!found.length) { await UPDATE(CaseFiles, row.ID).with({ watch: JSON.stringify(cf.watch) }); continue; }
    const last = await SELECT.one.from(ChatMessages).columns('max(seq) as m').where({ caseFile_ID: row.ID });
    let seq = (last?.m ?? 0) + 1;
    for (const a of found) {
      await INSERT.into(ChatMessages).entries({ caseFile_ID: row.ID, seq: seq++, role: 'agent', agent: a.agent, text: a.text,
        card: JSON.stringify({ type: 'alert', kind: a.kind, subject: a.subject, roleID: a.roleID, on: now }) });
      await queue(row.ID, a.kind, a.subject, a.text);
      emit('case.alert', { caseID: row.ID, code: caseCode(row.ID), kind: a.kind, subject: a.subject });
      cf.watch.alerted.push(a.key);
      alerts.push({ caseID: row.ID, code: caseCode(row.ID), name: row.name || 'Guest', kind: a.kind, subject: a.subject });
    }
    await UPDATE(CaseFiles, row.ID).with({ watch: JSON.stringify(cf.watch) });
  }
  LOG.info(`scanned ${rows.length} watched case(s) as of ${now}: ${alerts.length} alert(s)`);
  return { asOf: now, scanned: rows.length, alerts };
}

module.exports = { runWatch };
