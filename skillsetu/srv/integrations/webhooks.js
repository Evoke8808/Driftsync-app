// Outgoing webhooks for partner systems. Each delivery is signed with the partner's secret
// (HMAC-SHA256 of the raw body, header X-SkillSetu-Signature: sha256=<hex>) so they can trust it.
const cds = require('@sap/cds');
const crypto = require('crypto');

const EVENTS = ['case.approved', 'case.changes_requested', 'case.disputed', 'case.pushed', 'case.hired', 'case.alert', 'case.unfair_rejection'];
const LOG = cds.log('webhooks');

async function emit(event, data) {
  try {
    const { Webhooks } = cds.entities('skillsetu');
    const hooks = (await SELECT.from(Webhooks)).filter((h) => (h.events || '').split(',').includes(event));
    for (const h of hooks) deliver(h, event, data);   // fire and forget: a slow partner never blocks a person
  } catch (e) { LOG.warn('emit failed', e.message); }
}

async function deliver(h, event, data) {
  const body = JSON.stringify({ event, at: new Date().toISOString(), data });
  const signature = 'sha256=' + crypto.createHmac('sha256', h.secret).update(body).digest('hex');
  let status;
  try {
    const r = await fetch(h.url, { method: 'POST', body, signal: AbortSignal.timeout(5000),
      headers: { 'Content-Type': 'application/json', 'X-SkillSetu-Event': event, 'X-SkillSetu-Signature': signature } });
    status = 'HTTP ' + r.status;
  } catch (e) { status = 'failed: ' + String(e.message).slice(0, 40); }
  LOG.info(event, '→', h.url, status);
  try { await UPDATE(cds.entities('skillsetu').Webhooks, h.ID).with({ lastStatus: `${event} ${status}`.slice(0, 60) }); } catch (e) { /* ignore */ }
}

module.exports = { emit, EVENTS };
