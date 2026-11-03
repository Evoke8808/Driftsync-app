// Counsellor OData service behind the SAP Fiori Elements app. Same sign-in and rules as the web app:
// only a signed-in counsellor gets in, and approve / request changes / send to SuccessFactors reuse the agents' code.
const cds = require('@sap/cds');
const lib = require('./agents/lib');
const orchestrator = require('./agents/orchestrator');
const sf = require('./integrations/successfactors');
const auth = require('./auth');

const STATUS = { active: ['In progress', 0], sent: ['Waiting for review', 2], changes: ['Changes requested', 1], approved: ['Approved', 3] };

module.exports = class CounsellorService extends cds.ApplicationService {
  init() {
    const { Cases } = this.entities;

    this.before('*', async (req) => {
      const u = await auth.who(req);
      if (u?.role !== 'counsellor') return req.reject(401, 'Only a signed-in counsellor can open the review app. Please use the counsellor sign-in.');
      req.ssUser = u;
    });

    // Fill the readable fields the Fiori app shows (skills with evidence, plan, fairness check, SuccessFactors status).
    this.after('READ', 'Cases', async (rows) => {
      const list = [].concat(rows || []).filter((r) => r?.ID);
      if (!list.length) return;
      const ids = list.map((r) => r.ID);
      const { CaseFiles, SFPushes } = lib.db();
      const [raw, pushes] = await Promise.all([
        SELECT.from(CaseFiles).columns('ID', 'skills', 'plan', 'profile', 'status').where({ ID: { in: ids } }),
        SELECT.from(SFPushes).columns('caseFile_ID', 'status', 'message', 'applicationId', 'createdAt').where({ caseFile_ID: { in: ids } }).orderBy('createdAt desc')
      ]);
      const byId = Object.fromEntries(raw.map((r) => [r.ID, r]));
      for (const r of list) {
        const x = byId[r.ID] || {};
        const skills = lib.parse(x.skills, []), plan = lib.parse(x.plan, null), barriers = lib.personBarriers(lib.parse(x.profile, {}));
        const st = STATUS[r.status || x.status] || [r.status, 0];
        const push = pushes.find((p) => p.caseFile_ID === r.ID);
        Object.assign(r, {
          code: lib.caseCode(r.ID),
          statusText: st[0], statusCriticality: st[1],
          skillCount: skills.length,
          skillsText: skills.map((s) => `${lib.label(s.skill)}${s.reason ? `: "${String(s.reason).slice(0, 140)}"` : ''}`).join('\n') || 'No skills yet',
          planText: plan?.steps?.length
            ? `${plan.roleTitle}: ${plan.steps.length} course(s), about ${plan.totalHours} h\n` + plan.steps.map((s) => `• ${s.course?.title} (${s.course?.provider}, ${s.course?.duration}) for ${lib.label(s.skill)}`).join('\n')
            : plan ? `${plan.roleTitle}: no courses needed` : 'No plan yet',
          barriersText: barriers.length ? barriers.join('\n') + '\n(SkillSetu ignores these and matches on skills only.)' : 'None: a typical résumé filter would not reject this person.',
          sfText: push ? `${push.status === 'sent' ? 'Sent' : 'Failed'}: ${push.message || ''}${push.applicationId ? ` (${push.applicationId})` : ''}` : 'Not sent yet'
        });
      }
    });

    const decide = (decision) => async (req) => {
      const ID = req.params[0]?.ID ?? req.params[0];
      const u = req.ssUser;
      const r = await orchestrator.review({ caseID: ID, decision, note: req.data.note, by: u && !u.internal ? { name: u.displayName, username: u.username } : null });
      if (!r) return req.error(404, 'Case not found');
      req.notify(decision === 'approved' ? 'Approved. The person sees your decision in their chat.' : 'Changes requested. The person sees your note in their chat.');
      return this.read(Cases, ID);
    };
    this.on('approve', 'Cases', decide('approved'));
    this.on('requestChanges', 'Cases', decide('changes'));

    this.on('sendToSuccessFactors', 'Cases', async (req) => {
      const ID = req.params[0]?.ID ?? req.params[0];
      const r = await sf.push(ID, null);
      if (r.error) return req.error(r.error, r.message);
      req.notify(`Sent to ${r.target}: application ${r.applicationId} for ${r.role} (${r.matchPercent}% match). Name not shared.`);
      return this.read(Cases, ID);
    });

    return super.init();
  }
};
