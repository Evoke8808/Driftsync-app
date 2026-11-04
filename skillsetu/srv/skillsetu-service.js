const cds = require('@sap/cds');
const lib = require('./agents/lib');
const orchestrator = require('./agents/orchestrator');
const sf = require('./integrations/successfactors');
const watch = require('./agents/watch');
const outbox = require('./agents/outbox');
const auth = require('./auth');
const courses = require('./courses');

const SkillSetuService = class SkillSetuService extends cds.ApplicationService {

  async init() {
    /* ---------- Sign-in and access rules ---------- */
    const COUNSELLOR_ONLY = new Set(['biasAudit', 'reviewCase', 'cases', 'sendToSuccessFactors', 'sfPushes', 'runWatch', 'markHired', 'outbox', 'recommendCourse', 'caseCourses', 'withdrawCourse']);
    const PRIVATE_ENTITIES = new Set(['CaseFiles', 'ChatMessages', 'AuditLog', 'Outbox', 'Candidates']);
    const deny = (req, status, code, message) => req.reject({ status, code, message });
    this.before('*', async (req) => {
      req.ssUser = await auth.who(req);
      const name = req.target?.name?.split('.').pop();
      const isCounsellor = req.ssUser?.role === 'counsellor';
      if ((COUNSELLOR_ONLY.has(req.event) || (req.event === 'READ' && PRIVATE_ENTITIES.has(name))) && !isCounsellor) {
        return deny(req, req.ssUser ? 403 : 401, 'COUNSELLOR_ONLY', 'Only a signed-in counsellor can do this. Please use the counsellor sign-in.');
      }
    });
    // Job seekers see only their own cases; a guest case (no owner) is open to whoever holds its ID.
    const canOpen = async (req, caseID) => {
      if (!caseID || req.ssUser?.role === 'counsellor') return true;
      const cf = await SELECT.one.from(lib.db().CaseFiles).columns('owner').where({ ID: caseID });
      return !cf || !cf.owner || cf.owner === req.ssUser?.username;
    };
    const authReply = (req, fn) => fn().then((r) => JSON.stringify(r)).catch((e) => e instanceof auth.AuthError ? deny(req, e.status, e.code, e.message) : Promise.reject(e));
    this.on('login', (req) => authReply(req, () => auth.login(req.data)));
    this.on('register', (req) => authReply(req, () => auth.register(req.data)));
    this.on('logout', async (req) => { await auth.logout(req); return JSON.stringify({ ok: true }); });
    this.on('me', (req) => JSON.stringify(req.ssUser && !req.ssUser.internal ? req.ssUser : null));

    // Is the signed-in job seeker's work email from a partner company? Asked over the Company MCP; no personal data returned.
    this.on('companyMatch', async (req) => {
      const u = req.ssUser && !req.ssUser.internal && req.ssUser.role === 'user' ? req.ssUser : null;
      if (!u) return JSON.stringify(null);
      const { AccountEmails, CompanyLinks } = lib.db();
      const acct = await SELECT.one.from(AccountEmails).where({ username: u.username });
      if (!acct?.email) return JSON.stringify(null);
      const r = await require('./integrations/company-mcp-client').safe('find_company_by_email', { email: acct.email });
      if (!r.data?.company || !r.data.employee) return JSON.stringify(null);
      const link = req.data.caseID && await SELECT.one.from(CompanyLinks).columns('ID').where({ username: u.username, caseID: req.data.caseID });
      return JSON.stringify({ company: r.data.company.name, title: r.data.employee.title, connected: !!link });
    });

    this.on('sendToSuccessFactors', async (req) => {
      const r = await sf.push(req.data.caseID, req.data.roleID || null);
      return r.error ? req.reject(r.error, r.message) : JSON.stringify(r);
    });
    this.on('biasAudit', async (req) => {
      const r = await lib.biasAudit(req.data.roleID);
      return r ? JSON.stringify(r) : req.reject(404, 'Job not found');
    });
    this.on('sfPushes', async (req) => JSON.stringify(await sf.history(req.data.caseID || null)));

    this.on('impact', async () => {
      const { CaseFiles, ImpactDistricts, SFPushes } = lib.db();
      const [cases, districts, pushes] = await Promise.all([
        SELECT.from(CaseFiles).columns('status', 'skills', 'district'), SELECT.from(ImpactDistricts).orderBy('placed desc'), SELECT.from(SFPushes).where({ status: 'sent' })
      ]);
      const skills = cases.reduce((n, c) => n + lib.parse(c.skills, []).length, 0);
      return JSON.stringify({
        live: { cases: cases.length, hiddenSkills: skills, sentToCounsellor: cases.filter((c) => c.status !== 'active').length,
          approved: cases.filter((c) => c.status === 'approved').length, pushedToSuccessFactors: new Set(pushes.map((p) => p.caseFile_ID)).size },
        districts, synthetic: true
      });
    });

    /* ---------- Multi-agent chat ---------- */
    this.on('chat', async (req) => {
      const { caseID, message, intent, roleID, name } = req.data;
      if (!String(message || '').trim() && !intent) return req.reject(400, 'Send a message or an intent');
      if (!await canOpen(req, caseID)) return deny(req, 403, 'NOT_YOUR_CASE', 'This case belongs to someone else.');
      const user = req.ssUser && !req.ssUser.internal && req.ssUser.role === 'user' ? req.ssUser : null;
      const out = await orchestrator.handle({ caseID, message, intent, roleID, name: name || (user && !caseID ? user.displayName : null), user });
      // A new case started by a signed-in job seeker belongs to them.
      if (user && !caseID && out.caseID) await UPDATE(lib.db().CaseFiles, out.caseID).with({ owner: user.username });
      return JSON.stringify(out);
    });

    this.on('caseView', async (req) => {
      if (!await canOpen(req, req.data.caseID)) return deny(req, 403, 'NOT_YOUR_CASE', 'This case belongs to someone else.');
      const v = await orchestrator.caseView(req.data.caseID);
      return v ? JSON.stringify(v) : req.reject(404, 'Case not found');
    });

    /* ---------- After-hire and job-risk watch ---------- */
    this.on('runWatch', async (req) => JSON.stringify(await watch.runWatch({ days: req.data.days || 0 })));
    this.on('outbox', async (req) => JSON.stringify(await outbox.list(req.data.caseID || null)));
    this.on('markHired', async (req) => {
      const { caseID, roleID } = req.data;
      const cf = caseID && await SELECT.one.from(lib.db().CaseFiles).columns('ID', 'targetRole_ID').where({ ID: caseID });
      if (!cf) return req.reject(404, 'Case not found');
      if (!roleID && !cf.targetRole_ID) return req.reject(400, 'Pick the role the person was hired into');
      return JSON.stringify(await orchestrator.handle({ caseID, force: 'growth', roleID: roleID || cf.targetRole_ID,
        forceReason: 'Counsellor marked the person as hired', extra: { hired: 'counsellor' } }));
    });
    // Background watch: a few minutes after start, then every 6 hours.
    if (!SkillSetuService._timer) {
      const tick = () => watch.runWatch().catch((e) => cds.log('watch').warn('watch failed', e.message));
      SkillSetuService._timer = setTimeout(() => { tick(); setInterval(tick, 6 * 3600e3).unref(); }, 3 * 60e3);
      SkillSetuService._timer.unref();
    }

    this.on('cases', async () => JSON.stringify(await orchestrator.listCases()));
    this.on('myCases', async (req) => {
      const { CaseFiles } = lib.db();
      const user = req.ssUser && !req.ssUser.internal ? req.ssUser : null;
      let ids;
      if (user?.role === 'user') ids = (await SELECT.from(CaseFiles).columns('ID').where({ owner: user.username })).map((r) => r.ID);
      else {
        // Guests: only the guest cases whose IDs this device remembers.
        const asked = String(req.data.ids || '').split(',').map((s) => s.trim()).filter(Boolean).slice(0, 50);
        ids = asked.length ? (await SELECT.from(CaseFiles).columns('ID', 'owner').where({ ID: { in: asked } })).filter((r) => !r.owner).map((r) => r.ID) : [];
      }
      return JSON.stringify(ids.length ? await orchestrator.listCases(ids) : []);
    });

    /* ---------- My assigned courses ---------- */
    await courses.ensureTable();
    const reply = (req, r) => r.error ? deny(req, r.error, 'COURSES', r.message) : JSON.stringify(r);
    const myCaseIDs = async (req) => {
      const { CaseFiles } = lib.db();
      const user = req.ssUser && !req.ssUser.internal ? req.ssUser : null;
      if (user?.role === 'user') return (await SELECT.from(CaseFiles).columns('ID').where({ owner: user.username })).map((r) => r.ID);
      const asked = String(req.data.ids || '').split(',').map((s) => s.trim()).filter(Boolean).slice(0, 50);
      return asked.length ? (await SELECT.from(CaseFiles).columns('ID', 'owner').where({ ID: { in: asked } })).filter((r) => !r.owner).map((r) => r.ID) : [];
    };
    this.on('myCourses', async (req) => JSON.stringify(await courses.list(await myCaseIDs(req))));
    this.on('respondCourse', async (req) => {
      const row = await SELECT.one.from(lib.db().AssignedCourses).columns('caseFile_ID').where({ ID: req.data.id });
      if (!row) return deny(req, 404, 'COURSES', 'Course not found on your list');
      if (!await canOpen(req, row.caseFile_ID)) return deny(req, 403, 'NOT_YOUR_CASE', 'This course list belongs to someone else.');
      return reply(req, await courses.respond(req.data));
    });
    this.on('recommendCourse', async (req) => {
      const u = req.ssUser && !req.ssUser.internal ? req.ssUser : null;
      return reply(req, await courses.recommend({ ...req.data, by: u ? { name: u.displayName, username: u.username } : null }));
    });
    this.on('caseCourses', async (req) => JSON.stringify(await courses.list([req.data.caseID].filter(Boolean))));
    this.on('withdrawCourse', async (req) => reply(req, await courses.withdraw(req.data)));

    this.on('reviewCase', async (req) => {
      const { caseID, decision, note } = req.data;
      if (!['approved', 'changes'].includes(decision)) return req.reject(400, 'decision must be "approved" or "changes"');
      const u = req.ssUser && !req.ssUser.internal ? req.ssUser : null;
      const r = await orchestrator.review({ caseID, decision, note, by: u ? { name: u.displayName, username: u.username } : null });
      return r ? JSON.stringify(r) : req.reject(404, 'Case not found');
    });

    await super.init();
  }
};
module.exports = SkillSetuService;
