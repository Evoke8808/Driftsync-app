// AI quality check: runs Skills Discovery on three test stories against the real AI.
// Run it from the project folder with:  node srv/agents/selftest.js
// It prints what the AI found (skills, quotes, its reply and next question) and also writes it to ai-debug.log.
const fs = require('fs');
const path = require('path');

const LOG = path.join(__dirname, '..', '..', 'ai-debug.log');
const MARK = 'eval v1';
const SKILLS = ['budget-management', 'scheduling', 'event-planning', 'negotiation', 'team-leadership', 'excel',
  'customer-service', 'communication', 'problem-solving', 'data-entry', 'project-management', 'time-management'];
const STORIES = [
  'मैं 12 साल से गाँव में स्वयं सहायता समूह चलाती हूँ। 15 महिलाओं की बचत का हिसाब रखती हूँ, बैंक से लोन दिलवाती हूँ, हर महीने मीटिंग बुलाती हूँ, और झगड़े होते हैं तो मैं ही सुलझाती हूँ।',
  'After my father fell ill I took over selling our mangoes at the mandi for 3 summers. I convinced wholesalers to pay ₹5 more a kilo, kept a notebook of who owed us what, and got my two cousins to help with loading every morning before 6.',
  'Naan 4 varusham temple festival committee la volunteer ah irundhen. Donation collect panni accounts maintain pannen, 200 per ku saapadu arrange pannen, decoration vendor kitta rate pesi kammi pannen.'
];

async function run() {
  const write = (m) => {
    const line = m.replace(/\s+/g, ' ').slice(0, 900);
    console.log(line);
    fs.appendFileSync(LOG, `${new Date().toISOString()} ${MARK}: ${line}\n`);
  };
  write('start');
  const agent = require('./skills-discovery');
  for (const story of STORIES) {
    const cf = { skills: [], profile: {}, prefs: {}, story: '', interviewStep: 0 };
    const info = {};
    const t0 = Date.now();
    const out = await agent.run({ cf, cat: { skills: SKILLS.map((name) => ({ ID: name, name })), roles: [], roleSkills: [], courses: [], skillById: {} }, message: story, log: { info() {}, warn() {} }, aiInfo: info });
    write(`${story.slice(0, 25)}… → ${cf.skills.map((s) => `${s.skill}[${s.by}]`).join(', ')} | ${Date.now() - t0}ms | ${out.ai ? out.ai.model : 'NO AI: ' + info.error}` +
      ` | ack: ${out.replies[0]?.text || ''} | q: ${out.replies[1]?.text || ''} | quotes: ${cf.skills.map((s) => s.reason).join(' / ')}`);
  }
  write('done');
}
run().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
