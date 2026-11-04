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
  await demoCompany();
}

// A demo partner company: ServiceFirst, where Meena works. Created once; edit it freely in the Company portal.
async function demoCompany() {
  const { Companies, CompanyEmployees, CompanyPostings, AccountEmails } = cds.entities('skillsetu');
  if (!await SELECT.one.from(AccountEmails).where({ username: 'meena' })) await INSERT.into(AccountEmails).entries({ username: 'meena', email: 'meena@servicefirst.in' });
  if (await SELECT.one.from(Companies).where({ domain: 'servicefirst.in' })) return;
  const ID = cds.utils.uuid();
  await INSERT.into(Companies).entries({ ID, name: 'ServiceFirst', domain: 'servicefirst.in', about: 'Customer service and billing support for telecom and utility clients, Hyderabad.' });
  await INSERT.into(CompanyEmployees).entries([
    { company_ID: ID, email: 'meena@servicefirst.in', name: 'Meena Reddy', title: 'Customer Service Representative', department: 'Customer Care', years: 4,
      skills: 'customer-service, communication, problem-solving, team-leadership, scheduling',
      projects: 'Billing dispute desk: handled about 60 billing complaints a day and wrote a Hindi and Telugu FAQ that cut repeat calls by 30%\nNew-joiner buddy programme: trained 12 new agents in their first month on calls and billing tools\nShift roster: built the weekly shift roster for a team of 8 in Google Sheets\nCustomer feedback review: summarised top complaint reasons every Friday for the team lead' },
    { company_ID: ID, email: 'arun@servicefirst.in', name: 'Arun Kumar', title: 'Billing Associate', department: 'Billing', years: 2,
      skills: 'data-entry, excel, customer-service', projects: 'Invoice clean-up: corrected 3,000 old customer records in Excel\nRefund tracker: kept the daily refund sheet for the billing team' }
  ]);
  await INSERT.into(CompanyPostings).entries([
    { company_ID: ID, title: 'Support Team Coach', department: 'Customer Care', location: 'Hyderabad', openings: 2, skills: 'team-leadership, communication, problem-solving',
      description: 'Coach new agents, run call reviews and help the team handle hard calls. Works alongside the new AI chatbot.' },
    { company_ID: ID, title: 'Escalations and Resolution Specialist', department: 'Customer Care', location: 'Hyderabad', openings: 3, skills: 'problem-solving, customer-service, communication, negotiation',
      description: 'Own the complaints the chatbot cannot solve: billing disputes, angry customers, refunds.' },
    { company_ID: ID, title: 'Workforce Scheduler', department: 'Operations', location: 'Hyderabad', openings: 1, skills: 'scheduling, excel, data-entry, time-management',
      description: 'Plan shifts and staffing for 200 agents using call-volume forecasts.' },
    { company_ID: ID, title: 'Training Coordinator', department: 'Learning', location: 'Hyderabad', openings: 1, skills: 'team-leadership, communication, scheduling, project-management',
      description: 'Plan and run onboarding batches and refresher training for agents.' },
    { company_ID: ID, title: 'Quality Analyst', department: 'Quality', location: 'Remote', openings: 1, skills: 'data-entry, excel, problem-solving, communication',
      description: 'Score call recordings, find patterns in complaints and report them to team leads.' }
  ]);
  cds.log('demo').info('created the demo company ServiceFirst');
}

module.exports = { ensure, DEMO };
