// The messages SkillSetu would email to a person. DEMO: nothing is sent; a real build plugs in an email or
// WhatsApp service here (only for people who gave a contact and opted in). The counsellor desk shows the outbox.
const { db } = require('./lib');

async function queue(caseID, kind, subject, body, channel = 'email') {
  const { Outbox } = db();
  await INSERT.into(Outbox).entries({ caseFile_ID: caseID, channel, kind, subject: String(subject).slice(0, 200), body, status: 'demo: not sent' });
}

async function list(caseID) {
  const { Outbox } = db();
  const q = SELECT.from(Outbox).orderBy('createdAt desc').limit(50);
  if (caseID) q.where({ caseFile_ID: caseID });
  return (await q).map((o) => ({ caseID: o.caseFile_ID, channel: o.channel, kind: o.kind, subject: o.subject, body: o.body, status: o.status, at: o.createdAt }));
}

module.exports = { queue, list };
