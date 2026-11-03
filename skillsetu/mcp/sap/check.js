#!/usr/bin/env node
// Quick check: which SAP source answers right now? Run from the skillsetu folder:  npm run sap:check
const sources = require('./sources');
(async () => {
  console.log('Set up:', sources.status());
  for (const prefer of ['successfactors', 'hana']) {
    const r = await sources.openRequisitions({ top: 5, prefer });
    console.log(`\nAsking ${prefer} first -> answered by: ${r.source} (${r.jobs.length} jobs, ${r.ms} ms)`);
    if (r.skipped.length) console.log('  not used:', r.skipped.join(' | '));
    for (const j of r.jobs.slice(0, 5)) console.log(`  ${j.jobReqId}: ${j.title}${j.location ? ', ' + j.location : ''}`);
  }
})();
