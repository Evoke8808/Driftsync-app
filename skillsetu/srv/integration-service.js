// SkillSetu Integration API v1 (REST). Thin layer over the same agents the chat uses,
// so a partner system gets exactly what a person sees: evidence-backed skills, fair matches, free courses.
const cds = require('@sap/cds');
const crypto = require('crypto');
const orchestrator = require('./agents/orchestrator');
const lib = require('./agents/lib');
const sf = require('./integrations/successfactors');
const { EVENTS } = require('./integrations/webhooks');

const LOG = cds.log('integration');
// Demo key unless SKILLSETU_API_KEY is set (on BTP, set it as an environment variable or use XSUAA instead).
const API_KEY = process.env.SKILLSETU_API_KEY || 'skillsetu-demo-key';
if (!process.env.SKILLSETU_API_KEY) LOG.info('Integration API uses the demo key "skillsetu-demo-key". Set SKILLSETU_API_KEY to change it.');

module.exports = class IntegrationService extends cds.ApplicationService {
  async init() {
    this.before('*', (req) => {
      const key = req.headers?.['x-api-key'] || req.http?.req?.headers?.['x-api-key'];
      if (key !== API_KEY) return req.reject(401, 'Missing or wrong x-api-key header');
    });

    const summary = async (caseID, replies = []) => {
      const v = await orchestrator.caseView(caseID);
      if (!v) return null;
      const c = v.caseFile;
      return {
        caseID: c.ID, code: c.code, name: c.name, status: c.status, externalRef: c.externalRef || null,
        skills: c.skills.map((s) => ({ skill: s.skill, label: lib.label(s.skill), evidence: s.reason || null, foundBy: s.by || null })),
        targetRole: c.targetRole, plan: c.plan ? { role: c.plan.roleTitle, courses: c.plan.steps.length, hours: c.plan.totalHours, weeks: c.plan.weeks } : null,
        messages: replies.map((r) => r.text)
      };
    };
    const mustCase = async (req, id) => {
      if (!id) return req.reject(400, 'caseID is required');
      const c = await SELECT.one.from(lib.db().CaseFiles).columns('ID').where({ ID: id });
      if (!c) return req.reject(404, 'Case not found');
      return true;
    };

    this.on('createCase', async (req) => {
      const { story, name, externalRef, district } = req.data;
      if (!String(story || '').trim()) return req.reject(400, 'story is required');
      const out = await orchestrator.handle({ message: story, name, force: 'skills', extra: { externalRef, district } });
      req.http?.res?.status(201);
      return summary(out.caseID, out.replies);
    });

    this.on('addToCase', async (req) => {
      const { caseID, text } = req.data;
      if (!(await mustCase(req, caseID))) return;
      if (!String(text || '').trim()) return req.reject(400, 'text is required');
      const out = await orchestrator.handle({ caseID, message: text, force: 'skills' });
      return summary(caseID, out.replies);
    });

    this.on('getCase', async (req) => (await mustCase(req, req.data.caseID)) && summary(req.data.caseID));

    this.on('getMatches', async (req) => {
      const { caseID, partTime, remote, city } = req.data;
      if (!(await mustCase(req, caseID))) return;
      const v = await orchestrator.caseView(caseID);
      const ranked = lib.rankRoles(v.caseFile.skills.map((s) => s.skill), await lib.catalog());
      return ranked.filter((m) => m.matchPercent > 0).filter((m) => {
        const r = m.role, isRemote = r.location === 'Remote' || r.type === 'remote';
        if (partTime && !(r.type === 'part-time' || isRemote)) return false;
        if (remote && !isRemote) return false;
        if (city && !(isRemote || r.location.toLowerCase() === String(city).toLowerCase())) return false;
        return true;
      }).slice(0, 10).map((m) => ({
        roleID: m.role.ID, title: m.role.title, company: m.role.company, location: m.role.location, salary: m.role.salary, type: m.role.type,
        matchPercent: m.matchPercent, matchedSkills: m.matchedSkills, missingSkills: m.missingSkills.map((s) => s.name),
        demand: m.role.demand, automationRisk: m.role.automationRisk
      }));
    });

    this.on('getLearningPlan', async (req) => {
      const { caseID, roleID } = req.data;
      if (!(await mustCase(req, caseID))) return;
      const v0 = await orchestrator.caseView(caseID);
      if (!v0.caseFile.skills.length) return req.reject(409, 'This case has no skills yet. Call addToCase first.');
      await orchestrator.handle({ caseID, roleID, force: 'pathway' });
      const p = (await orchestrator.caseView(caseID)).caseFile.plan;
      return { role: p.roleTitle, matchToday: p.matchToday, totalHours: p.totalHours, weeks: p.weeks,
        steps: p.steps.map((s) => ({ skill: s.skill, course: s.course.title, provider: s.course.provider, url: s.course.url, duration: s.course.duration, level: s.course.level })) };
    });

    const fairness = (a) => ({
      role: a.role.title, threshold: a.threshold,
      resumeFilterFailingGroups: a.summary.resumeFilterFailingGroups, skillsFirstFailingGroups: a.summary.skillsFirstFailingGroups,
      qualified: a.summary.qualified, qualifiedRejectedByResumeFilter: a.summary.qualifiedRejectedByResumeFilter,
      groups: a.groups.map((g) => ({ group: g.label, applicants: g.n, resumeFilterRate: +g.resumeFilter.rate.toFixed(2), resumeFilterAIR: g.resumeFilter.air,
        skillsFirstRate: +g.skillsFirst.rate.toFixed(2), skillsFirstAIR: g.skillsFirst.air }))
    });

    this.on('getReadiness', async (req) => {
      const { caseID } = req.data;
      if (!(await mustCase(req, caseID))) return;
      const v0 = await orchestrator.caseView(caseID);
      if (!v0.caseFile.skills.length) return req.reject(409, 'This case has no skills yet. Call addToCase first.');
      const out = await orchestrator.handle({ caseID, force: 'readiness' });
      const card = out.replies[0]?.card || {};
      const role = await SELECT.one.from(lib.db().Roles).where({ title: card.role });
      return { caseID, role: card.role, matchPercent: card.matchPercent, filterBarriers: card.barriers || [], tips: card.tips || [],
        audit: role ? fairness(await lib.biasAudit(role.ID)) : null };
    });

    this.on('getFairnessAudit', async (req) => {
      const a = req.data.roleID && await lib.biasAudit(req.data.roleID);
      return a ? fairness(a) : req.reject(404, 'Role not found');
    });

    this.on('submitForReview', async (req) => {
      const { caseID } = req.data;
      if (!(await mustCase(req, caseID))) return;
      const out = await orchestrator.handle({ caseID, force: 'human' });
      return summary(caseID, out.replies);
    });

    this.on('pushToSuccessFactors', async (req) => {
      const { caseID, roleID } = req.data;
      if (!(await mustCase(req, caseID))) return;
      const r = await sf.push(caseID, roleID);
      return r.error ? req.reject(r.error, r.message) : r;
    });

    const { Webhooks } = lib.db();
    const hookOut = (h) => ({ id: h.ID, url: h.url, events: (h.events || '').split(',').filter(Boolean), secret: h.secret, lastStatus: h.lastStatus || null });
    this.on('registerWebhook', async (req) => {
      const { url } = req.data;
      const events = (req.data.events?.length ? req.data.events : EVENTS).filter((e) => EVENTS.includes(e));
      if (!/^https?:\/\/\S+$/.test(String(url || ''))) return req.reject(400, 'url must be an http(s) URL');
      if (!events.length) return req.reject(400, `events must be some of: ${EVENTS.join(', ')}`);
      const h = { ID: cds.utils.uuid(), url, events: events.join(','), secret: crypto.randomBytes(24).toString('hex') };
      await INSERT.into(Webhooks).entries(h);
      req.http?.res?.status(201);
      return hookOut(h);
    });
    this.on('listWebhooks', async () => (await SELECT.from(Webhooks).orderBy('createdAt')).map((h) => ({ ...hookOut(h), secret: undefined })));
    this.on('deleteWebhook', async (req) => (await DELETE.from(Webhooks).where({ ID: req.data.id })) > 0);

    await super.init();
  }
};
