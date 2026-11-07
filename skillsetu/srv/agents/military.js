// Ex-servicemen translator: turns Indian Army, Navy and Air Force ranks, trades and duties into
// civilian job language and catalog skills. Pure code, so it works when the AI is offline.
// Used by Skills Discovery. Words like "captain" or "driver" only count when the story is clearly about the forces.

const CONTEXT = /\b(army|navy|naval|air ?force|iaf|military|armed forces|defen[cs]e (forces|services)|regiment|battalion|brigade|corps|jawans?|fauj|faujee?|sena|ex[- ]?service(man|men|woman)?|veteran|jco|nco|bsf|crpf|cisf|itbp|assam rifles|paramilitary)\b|फ़ौज|फौज|सेना|आर्मी|नेवी|वायुसेना|जवान/i;

// Ranks. own: the word only appears in a forces context anyway, so it proves context by itself.
const RANKS = [
  // Army (and paramilitary) other ranks and JCOs
  { re: /\bsubedar[- ]major\b|सूबेदार मेजर/i, term: 'Subedar Major', service: 'Army', civilian: 'Senior operations manager', detail: 'senior-most JCO: advised the commanding officer, ran administration and discipline for a unit of hundreds', skills: ['team-leadership', 'project-management', 'problem-solving', 'communication'], own: true },
  { re: /\bnaib[- ]subedar\b|\bnb\.? ?sub\b|नायब सूबेदार/i, term: 'Naib Subedar', service: 'Army', civilian: 'Operations supervisor', detail: 'junior commissioned officer: led a platoon of about 30 and handled its administration', skills: ['team-leadership', 'scheduling', 'problem-solving'], own: true },
  { re: /\bsubedar\b|सूबेदार/i, term: 'Subedar', service: 'Army', civilian: 'Operations supervisor', detail: 'junior commissioned officer: led a platoon of about 30, its training, roster and administration', skills: ['team-leadership', 'scheduling', 'project-management'], own: true },
  { re: /\bhavildar\b|\bhav\b|हवलदार/i, term: 'Havildar', service: 'Army', civilian: 'Team supervisor', detail: 'led a section of about 10 people: duties, training and discipline', skills: ['team-leadership', 'scheduling'], own: true },
  { re: /\blance[- ]naik\b|लांस नायक/i, term: 'Lance Naik', service: 'Army', civilian: 'Team lead', detail: 'second-in-command of a small team', skills: ['team-leadership', 'time-management'], own: true },
  // Naik is also a surname, so it needs forces context.
  { re: /\bnaik\b|नायक/i, term: 'Naik', service: 'Army', civilian: 'Team lead', detail: 'led a small team and stood in for the section commander', skills: ['team-leadership', 'time-management'] },
  { re: /\bsepoy\b|\bsipahi\b|सिपाही/i, term: 'Sepoy', service: 'Army', civilian: 'Trained team member', detail: 'disciplined, reliable, used to shifts and strict timings', skills: ['time-management'], own: true },
  // Navy
  { re: /\bmaster chief petty officer\b|\bmcpo\b/i, term: 'Master Chief Petty Officer', service: 'Navy', civilian: 'Senior operations manager', detail: 'senior-most sailor: ran a department’s people and routines', skills: ['team-leadership', 'project-management', 'problem-solving'], own: true },
  { re: /\bchief petty officer\b|\bcpo\b/i, term: 'Chief Petty Officer', service: 'Navy', civilian: 'Operations supervisor', detail: 'supervised a division of sailors and its work schedule', skills: ['team-leadership', 'scheduling'], own: true },
  { re: /\bpetty officer\b/i, term: 'Petty Officer', service: 'Navy', civilian: 'Team supervisor', detail: 'supervised a team of sailors on watch and at work', skills: ['team-leadership', 'scheduling'], own: true },
  { re: /\bleading seaman\b/i, term: 'Leading Seaman', service: 'Navy', civilian: 'Team lead', detail: 'led a small team of sailors', skills: ['team-leadership', 'time-management'], own: true },
  { re: /\bseaman\b|\bsailor\b/i, term: 'Seaman', service: 'Navy', civilian: 'Trained team member', detail: 'watch-keeping and shift work to strict timings', skills: ['time-management'], own: true },
  // Air Force
  { re: /\bmaster warrant officer\b|\bmwo\b/i, term: 'Master Warrant Officer', service: 'Air Force', civilian: 'Senior operations manager', detail: 'senior-most airman: ran a section’s people, records and standards', skills: ['team-leadership', 'project-management', 'problem-solving'], own: true },
  { re: /\bjunior warrant officer\b|\bjwo\b/i, term: 'Junior Warrant Officer', service: 'Air Force', civilian: 'Operations supervisor', detail: 'supervised airmen and a section’s daily work', skills: ['team-leadership', 'scheduling'], own: true },
  { re: /\bwarrant officer\b/i, term: 'Warrant Officer', service: 'Air Force', civilian: 'Operations supervisor', detail: 'supervised airmen, records and daily work', skills: ['team-leadership', 'scheduling'], own: true },
  { re: /\b(leading )?aircraftsman\b|\baircraftman\b/i, term: 'Aircraftman', service: 'Air Force', civilian: 'Trained team member', detail: 'technical or support work to strict standards and timings', skills: ['time-management'], own: true },
  { re: /\bsergeant\b|\bsgt\b/i, term: 'Sergeant', service: 'Air Force', civilian: 'Team supervisor', detail: 'supervised a team of airmen', skills: ['team-leadership', 'scheduling'] },
  { re: /\bcorporal\b|\bcpl\b/i, term: 'Corporal', service: 'Air Force', civilian: 'Team lead', detail: 'led a small team of airmen', skills: ['team-leadership'] },
  // Officers (all three services)
  { re: /\b(brigadier|commodore|air commodore)\b/i, term: 'Brigadier / Commodore', service: 'Forces', civilian: 'Director of operations', detail: 'led thousands of people and large budgets', skills: ['team-leadership', 'project-management', 'budget-management', 'communication'], own: true },
  { re: /\b(?:as|rank of|retired|became|promoted to|was)\s+(?:an?\s+)?(lt\.? ?col(onel)?|lieutenant colonel|colonel|col\.|wing commander|wg cdr|group captain|commander)\b/i, term: 'Colonel / Wing Commander', service: 'Forces', civilian: 'General manager', detail: 'commanded a unit of hundreds: people, budget and operations', skills: ['team-leadership', 'project-management', 'budget-management', 'communication'] },
  { re: /\b(?:as|rank of|retired|became|promoted to|was)\s+(?:an?\s+)?(major|squadron leader|sqn ldr|lieutenant commander|lt cdr)\b/i, term: 'Major / Squadron Leader', service: 'Forces', civilian: 'Operations manager', detail: 'commanded a company of about 100 and its planning', skills: ['team-leadership', 'project-management', 'communication'] },
  { re: /\b(?:as|rank of|retired|became|promoted to|was)\s+(?:an?\s+)?(captain|capt\.?|flight lieutenant|flt lt|lieutenant|lt\.?|flying officer|sub[- ]lieutenant)\b/i, term: 'Captain / Lieutenant', service: 'Forces', civilian: 'Team manager', detail: 'led a platoon or flight of about 30 and its planning', skills: ['team-leadership', 'project-management'] }
];

// Trades and duties. These words also exist outside the forces, so they need forces context.
const TRADES = [
  { re: /\bclerk\b|\bwriter\b|\badmin(istration)? (clerk|staff|work)\b|\boffice work\b|क्लर्क/i, term: 'Clerk', civilian: 'Office administrator', detail: 'files, records, letters and returns', skills: ['data-entry', 'communication'], jobs: ['Office administrator', 'Data entry operator'] },
  { re: /\bstore ?keeper\b|\bstores?\b|\bquarter ?master\b|\binventory\b|\bstock (register|records?)\b|\bration(s)?\b|\blogistics\b|स्टोर|राशन/i, term: 'Storekeeper / logistics', civilian: 'Inventory and stores executive', detail: 'kept stock registers and issued supplies without losses', skills: ['data-entry', 'budget-management'], jobs: ['Stores executive', 'Warehouse supervisor', 'Procurement assistant'] },
  { re: /\bpay (and )?accounts?\b|\bpay ?corps\b|\bcanteen accounts?\b|\bmess accounts?\b|\bunit funds?\b|\baccounts\b|\bbudget\b/i, term: 'Accounts / funds', civilian: 'Accounts assistant', detail: 'kept accounts and handled unit money', skills: ['budget-management', 'data-entry'], jobs: ['Accounts assistant'] },
  { re: /\b(canteen|csd|mess)\b(?!\s+(accounts?|funds?))/i, term: 'Canteen / mess', civilian: 'Canteen or facility supervisor', detail: 'ran a canteen or mess for many people every day', skills: ['customer-service', 'budget-management'], jobs: ['Facility supervisor', 'Kitchen and catering supervisor'] },
  { re: /\bcook\b|\bchef\b|\bsteward\b|रसोइया|खाना बनाता/i, term: 'Cook / steward', civilian: 'Bulk kitchen supervisor', detail: 'cooked for large numbers to fixed timings', skills: ['time-management', 'event-planning'], jobs: ['Kitchen and catering supervisor'] },
  { re: /\bdriver\b|\bmt\b|\bmechanical transport\b|\bconvoy\b|ड्राइवर/i, term: 'Driver / transport', civilian: 'Transport and dispatch coordinator', detail: 'moved people and supplies safely and on time', skills: ['scheduling', 'time-management'], jobs: ['Dispatch coordinator', 'Fleet supervisor'] },
  { re: /\bsignals?\b|\bradio\b|\bwireless\b|\b(radio|wireless|signal|communications?) (operator|network|centre|center)\b/i, term: 'Signals / communications', civilian: 'Communications and IT support', detail: 'ran radio and communication networks', skills: ['communication', 'problem-solving'], jobs: ['IT support assistant', 'Control room operator'] },
  { re: /\bnursing assistant\b|\bmedical assistant\b|\bambulance\b|\bmedic\b|\bmilitary hospital\b/i, term: 'Nursing / medical', civilian: 'Patient care assistant', detail: 'cared for patients and kept medical records', skills: ['customer-service', 'communication', 'time-management'], jobs: ['Front office executive (clinic)', 'Health outreach coordinator'] },
  { re: /\b(electrician|fitter|mechanic|technician|eme|engineers?|craftsman|vehicle mechanic|armourer)\b/i, term: 'Technical trade', civilian: 'Maintenance technician', detail: 'kept equipment working and fixed faults fast', skills: ['problem-solving'], jobs: ['Maintenance supervisor', 'Facility technician'] },
  { re: /\b(military police|provost|security (duty|guard|supervisor|in-charge|incharge)|guard duty|sentry)\b/i, term: 'Security / provost', civilian: 'Security supervisor', detail: 'security, access control and incident handling', skills: ['problem-solving', 'communication'], jobs: ['Security supervisor'] },
  { re: /\b(instructor|trained (new )?(recruits|jawans|soldiers|sailors|airmen)|training (new )?recruits|drill)\b/i, term: 'Instructor / trainer', civilian: 'Trainer', detail: 'trained new recruits', skills: ['team-leadership', 'communication'], jobs: ['Trainer', 'Team lead'] },
  { re: /\b(duty roster|roster|shifts?|watch ?bill|guard roster)\b|ड्यूटी रोस्टर/i, term: 'Duty roster', civilian: 'Shift scheduler', detail: 'planned who works when, every day', skills: ['scheduling'], jobs: ['Shift supervisor'] },
  { re: /\b(flood|disaster|earthquake|rescue|relief) (relief|operations?|work|duty)?\b|\bpeace ?keeping\b|\bun mission\b/i, term: 'Relief / UN operations', civilian: 'Crisis operations', detail: 'stayed calm and solved problems under pressure', skills: ['problem-solving', 'communication'], jobs: ['Operations coordinator'] }
];

const yearsServed = (t) => {
  const m = t.match(/(\d{1,2})\s*(?:years?\b|yrs\b|saal\b|साल)[^.।]{0,40}?(?:army|navy|air ?force|forces|service|fauj|सेना|फ़ौज|फौज)/i)
    || t.match(/(?:served|service of|army|navy|air ?force|forces)[^.\d]{0,40}?(\d{1,2})\s*(?:years?\b|yrs\b|saal\b|साल)/i);
  return m ? +m[1] : null;
};
const serviceName = (t) => (/\bnavy|naval|नेवी\b/i.test(t) ? 'Navy' : /air ?force|\biaf\b|वायुसेना/i.test(t) ? 'Air Force'
  : /\b(bsf|crpf|cisf|itbp|assam rifles|paramilitary)\b/i.test(t) ? 'Paramilitary' : /army|fauj|सेना|फ़ौज|फौज|आर्मी/i.test(t) ? 'Army' : null);

// The words around a match, as the person's own proof.
function quote(text, index) {
  const from = Math.max(0, text.lastIndexOf('.', index) + 1, text.lastIndexOf(',', index) + 1, text.lastIndexOf('।', index) + 1);
  let to = text.slice(index).search(/[,.।]/);
  to = to < 0 ? text.length : index + to;
  return text.slice(from, to).trim().slice(0, 140);
}

// Returns null when the text is not about service in the forces. Otherwise:
// { service, years, rows: [{ term, kind, civilian, detail, skills, quote, jobs }], skills: [{ skill, reason }] }
function translate(text) {
  const t = String(text || '');
  const rankHits = RANKS.map((r) => ({ r, i: t.search(r.re) })).filter((x) => x.i >= 0);
  const context = CONTEXT.test(t) || rankHits.some((x) => x.r.own);
  if (!context) return null;

  const rows = [];
  // Only the highest rank counts (RANKS is ordered senior-first within each service), so "Naik" inside "Lance Naik" is not counted twice.
  const rank = rankHits.find((x) => x.r.own || CONTEXT.test(t));
  if (rank) rows.push({ term: rank.r.term, kind: 'rank', civilian: rank.r.civilian, detail: rank.r.detail, skills: rank.r.skills, quote: quote(t, rank.i), service: rank.r.service });
  for (const tr of TRADES) {
    const i = t.search(tr.re);
    if (i >= 0) rows.push({ term: tr.term, kind: 'trade', civilian: tr.civilian, detail: tr.detail, skills: tr.skills, quote: quote(t, i), jobs: tr.jobs });
  }
  const service = serviceName(t) || (rank && rank.r.service !== 'Forces' ? rank.r.service : null);
  if (!rows.length) rows.push({ term: service ? `${service} service` : 'Service in the forces', kind: 'service', civilian: 'Disciplined team member', detail: 'strict timings, teamwork and duty under pressure', skills: ['time-management'], quote: quote(t, Math.max(0, t.search(CONTEXT))) });

  const skills = [];
  // Duties give more specific proof than the rank, so they quote first.
  for (const row of [...rows.filter((r) => r.kind !== 'rank'), ...rows.filter((r) => r.kind === 'rank')]) for (const skill of row.skills) if (!skills.some((s) => s.skill === skill)) skills.push({ skill, reason: row.quote || row.term, via: row.term });
  return { service, years: yearsServed(t), rows, skills };
}

module.exports = { translate };
