// Demo accounts for the one-click sign-in on the sign-in page. Created on start if they don't exist yet;
// existing accounts (and their passwords) are never changed. Password for all of them: skillsetu123.
const cds = require('@sap/cds');
const auth = require('./auth');

const DEMO_PASSWORD = 'skillsetu123';
const DEMO = [
  { username: 'priya', displayName: 'Priya Sharma', role: 'user' },
  { username: 'vikram', displayName: 'Vikram Singh', role: 'user' },
  { username: 'meena', displayName: 'Meena Reddy', role: 'user' },
  { username: 'meera.ccp', displayName: 'Meera Iyer (counsellor)', role: 'counsellor' },
  { username: 'anita.ccp', displayName: 'Anita Rao (counsellor)', role: 'counsellor' }
];

// Try a few times: right after start the database connection may still be opening.
async function ensure(tries = 4) {
  for (let i = 1; i <= tries; i++) {
    try { return await create(); }
    catch (e) { if (i === tries) throw e; await new Promise((r) => setTimeout(r, 3000 * i)); }
  }
}

async function create() {
  const { Accounts } = cds.entities('skillsetu');
  let made = 0;
  for (const a of DEMO) {
    if (await SELECT.one.from(Accounts).columns('username').where({ username: a.username })) continue;
    await INSERT.into(Accounts).entries({ ...a, secret: auth.hash(DEMO_PASSWORD) });
    made++;
  }
  if (made) cds.log('demo').info(`created ${made} demo account(s)`);
}

module.exports = { ensure, DEMO };
