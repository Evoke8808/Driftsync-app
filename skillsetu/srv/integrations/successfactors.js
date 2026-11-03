// SAP SuccessFactors Recruiting connector. Hands an APPROVED, anonymised candidate to SuccessFactors:
// makes sure the job requisition exists, creates or updates the Candidate, and creates a JobApplication
// with the match % and a "fairness checked" flag. Uses CAP's remote-service API, so the same code runs
// against the built-in mock (cds watch) or a real tenant through a BTP destination.
const cds = require('@sap/cds');
const { db, catalog, matchRoles, caseCode, label, parse } = require('../agents/lib');
const { emit } = require('./webhooks');
const sapMcp = require('./sap-mcp-client');

async function push(caseID, roleID) {
  const { CaseFiles, Roles, SFPushes } = db();
  const cf = await SELECT.one.from(CaseFiles).where({ ID: caseID });
  if (!cf) return { error: 404, message: 'Case not found' };
  if (cf.status !== 'approved') return { error: 409, message: 'A counsellor must approve this case before it can go to SuccessFactors.' };

  const plan = parse(cf.plan, null), skills = parse(cf.skills, []);
  // A growth plan means they're already ready for the target role, so apply there.
  const rid = roleID || (plan?.readyFor ? cf.targetRole_ID : plan?.roleID) || cf.targetRole_ID;
  const role = rid && await SELECT.one.from(Roles).where({ ID: rid });
  if (!role) return { error: 400, message: 'No target role on this case. Pass roleID.' };
  const match = matchRoles(skills.map((s) => s.skill), await catalog()).find((m) => m.role.ID === role.ID);

  const code = caseCode(cf.ID);
  // A job that came from SAP keeps its real requisition ID, so the application lands on the same SAP job.
  const jobReqId = sapMcp.isSapRole(role.ID) ? sapMcp.jobReqOf(role.ID) : 'SKS-' + role.ID.replace(/-/g, '').slice(-6).toUpperCase();
  const candidateId = 'C-' + code;
  const applicationId = `A-${code}-${jobReqId}`;
  try {
    const { sf, ents } = await sfService();
    const { Candidate, JobRequisition, JobApplication } = ents;
    if (!await sf.run(SELECT.one.from(JobRequisition).where({ jobReqId }))) {
      await sf.run(INSERT.into(JobRequisition).entries({ jobReqId, jobCode: role.title.toUpperCase().replace(/\W+/g, '_'), jobTitle: role.title, location: role.location, status: 'Open' }));
    }
    const cand = { candidateId, firstName: 'SkillSetu', lastName: code, country: 'IND', cust_skillsetuCode: code,
      cust_skills: skills.map((s) => `${label(s.skill)}${s.reason ? ` ("${String(s.reason).slice(0, 60)}")` : ''}`).join(', ').slice(0, 1000) };
    if (await sf.run(SELECT.one.from(Candidate).where({ candidateId }))) await sf.run(UPDATE(Candidate).set(cand).where({ candidateId }));
    else await sf.run(INSERT.into(Candidate).entries(cand));
    const app = { applicationId, candidateId, jobReqId, status: 'Applied', source: 'SkillSetu', cust_matchPercent: match?.matchPercent ?? 0,
      cust_fairnessChecked: true, cust_counsellorNote: cf.counsellorNote || null };
    if (await sf.run(SELECT.one.from(JobApplication).where({ applicationId }))) await sf.run(UPDATE(JobApplication).set(app).where({ applicationId }));
    else await sf.run(INSERT.into(JobApplication).entries(app));

    await INSERT.into(SFPushes).entries({ caseFile_ID: cf.ID, role_ID: role.ID, candidateId, applicationId, jobReqId, status: 'sent', message: `Applied to ${role.title}` });
    await log(cf.ID, `Sent to SAP SuccessFactors: application ${applicationId} for ${role.title} (${match?.matchPercent ?? 0}% match). Name not shared.`);
    emit('case.pushed', { caseID: cf.ID, code, role: role.title, candidateId, applicationId, jobReqId });
    return { caseID: cf.ID, code, role: role.title, jobReqId, candidateId, applicationId, matchPercent: match?.matchPercent ?? 0, status: 'sent', target: sfTarget() };
  } catch (e) {
    await INSERT.into(SFPushes).entries({ caseFile_ID: cf.ID, role_ID: role.ID, candidateId, applicationId, jobReqId, status: 'failed', message: String(e.message).slice(0, 500) });
    return { error: 502, message: 'SuccessFactors did not accept the candidate: ' + e.message };
  }
}

// Real tenant when a destination is configured; otherwise the mock (served by cds watch, or straight on the local DB).
async function sfService() {
  if (cds.env.requires.SFRecruiting?.credentials) { const sf = await cds.connect.to('SFRecruiting'); return { sf, ents: sf.entities }; }
  return { sf: cds.db, ents: cds.entities('sfmock') };
}
const sfTarget = () => (cds.env.requires.SFRecruiting?.credentials ? 'SAP SuccessFactors tenant' : 'SAP SuccessFactors (demo mock)');

async function log(caseID, reason) {
  const { AuditLog } = db();
  const r = await SELECT.one.from(AuditLog).columns('max(seq) as m').where({ caseFile_ID: caseID });
  await INSERT.into(AuditLog).entries({ caseFile_ID: caseID, seq: (r?.m ?? 0) + 1, agent: 'human', routedBy: '-', reason, provider: 'SAP SuccessFactors', model: null, ms: 0 });
}

async function history(caseID) {
  const { SFPushes } = db();
  return SELECT.from(SFPushes).where(caseID ? { caseFile_ID: caseID } : {}).orderBy('createdAt desc').limit(50);
}

module.exports = { push, history };
