namespace skillsetu;

using { cuid, managed } from '@sap/cds/common';

// Skills from ESCO taxonomy
entity Skills : cuid {
  code        : String(50);    // ESCO code like "S1.1.1"
  name        : String(100);   // "budget-management"
  category    : String(50);    // "financial", "interpersonal", "technical"
  description : String(500);
}

// Job roles employers are hiring for
entity Roles : cuid {
  title       : String(100);   // "Operations Coordinator"
  company     : String(100);
  location    : String(100);
  description : String(1000);
  salary      : String(50);
  type        : String(20);    // "full-time", "part-time", "remote", "apprenticeship"
  demand         : String(10);  // hiring demand: High / Medium / Low (illustrative demo data)
  automationRisk : String(10);  // chance the role gets automated: Low / Medium / High (illustrative)
  requiredSkills : Composition of many RoleSkills on requiredSkills.role = $self;
}

// Junction: which skills a role requires
entity RoleSkills : cuid {
  role        : Association to Roles;
  skill       : Association to Skills;
  importance  : String(20);    // "required", "preferred"
}

// Learning courses to close skill gaps
entity Courses : cuid {
  title       : String(200);
  provider    : String(100);   // "SAP Learning Hub", "SWAYAM", "NPTEL"
  url         : String(500);
  duration    : String(50);    // "2 hours", "4 weeks"
  skill       : Association to Skills;  // Which skill this course teaches
  level       : String(20);    // "beginner", "intermediate", "advanced"
}

// Synthetic applicant pool for the bias audit. Every group shares the same skill mix,
// so any gap in selection rates comes from the screening method, not ability.
entity Candidates : cuid {
  alias              : String(30);   // what employers see, e.g. "Candidate #4821"
  groupKey           : String(30);
  groupLabel         : String(60);
  age                : Integer;
  gapYears           : Integer;
  education          : String(20);   // degree-tier1, degree-tier2, degree-tier3, none
  titleMatch         : Boolean;      // past job title contains the posting's keywords
  needsAccommodation : Boolean;      // needs an accessible assessment
  skills             : String(500);  // semicolon-separated skill names
}

// One person's journey with the agents. The orchestrator reads and updates it on every message.
entity CaseFiles : cuid, managed {
  name           : String(100);
  story          : LargeString;   // everything the person told Skills Discovery
  skills         : LargeString;   // JSON [{ skill, reason, by }]
  profile        : LargeString;   // JSON { age, gapYears, education, needsAccommodation, pastTitle } (for barrier checks only, never shown to employers)
  prefs          : LargeString;   // JSON { type, location }
  targetRole     : Association to Roles;
  plan           : LargeString;   // JSON learning plan from Learning Pathway
  interviewStep  : Integer default 0;
  asked          : String(100);   // fallback interview questions already asked
  lastAgent      : String(30);
  status         : String(20) default 'active';  // active, sent, approved, changes
  counsellorNote : String(1000);
  externalRef    : String(100);   // the caller's own ID when the case came in through the Integration API
  district       : String(60);    // optional, for the impact dashboard
  watch          : LargeString;   // JSON { on, since, hiredAt, alerted[], checkins[] }: the after-hire and job-risk watch
  owner          : String(60);    // username of the job seeker who owns the case (empty for a guest)
  reviewedBy     : String(100);   // the counsellor who made the last decision, e.g. "Meera (meera.ccp)"
  messages       : Composition of many ChatMessages on messages.caseFile = $self;
  log            : Composition of many AuditLog on log.caseFile = $self;
}

entity ChatMessages : cuid, managed {
  caseFile : Association to CaseFiles;
  seq      : Integer;
  role     : String(12);    // user, agent, counsellor
  agent    : String(30);
  text     : LargeString;
  card     : LargeString;   // JSON card the UI renders
}

// Every routing decision and agent run, so a person can see why the AI did what it did.
entity AuditLog : cuid, managed {
  caseFile : Association to CaseFiles;
  seq      : Integer;
  agent    : String(30);
  routedBy : String(10);    // button, rules, ai, -
  reason   : String(500);
  provider : String(60);    // AI provider, or "rules" when no AI was used
  model    : String(80);
  ms       : Integer;
}

// Integration API: partners register a URL; SkillSetu POSTs signed JSON events to it.
entity Webhooks : cuid, managed {
  url    : String(500);
  events : String(300);   // comma separated: case.approved, case.changes_requested, case.disputed, case.pushed
  secret : String(64);    // used to sign each delivery (HMAC-SHA256, header X-SkillSetu-Signature)
  lastStatus : String(60);
}

// Every push of an approved candidate to SAP SuccessFactors Recruiting.
entity SFPushes : cuid, managed {
  caseFile      : Association to CaseFiles;
  role          : Association to Roles;
  candidateId   : String(40);
  applicationId : String(40);
  jobReqId      : String(40);
  status        : String(20);    // sent | failed
  message       : String(500);
}

// Impact dashboard: district-level pilot figures (SYNTHETIC demo data, clearly labelled in the UI).
entity ImpactDistricts : cuid {
  district        : String(60);
  state           : String(60);
  people          : Integer;   // people who told their story
  hiddenSkills    : Integer;   // skills found that were never on a CV
  approved        : Integer;   // plans approved by a counsellor
  placed          : Integer;   // people placed in a job or apprenticeship
  women           : Integer;   // of people, women
  coursesDone     : Integer;
  filterAIR       : Decimal(4,2);   // worst group's adverse impact ratio under a résumé filter
  skillsetuAIR    : Decimal(4,2);   // same, under SkillSetu skills-first matching
}

// Messages the watch would email or WhatsApp to a person (new better match, job-risk warning, check-in).
// DEMO: nothing is actually sent; the counsellor desk shows this outbox.
entity Outbox : cuid, managed {
  caseFile : Association to CaseFiles;
  channel  : String(20);    // email, whatsapp
  kind     : String(20);    // match, risk, checkin, hired
  subject  : String(200);
  body     : LargeString;
  status   : String(40);    // "demo: not sent"
}

// Courses on a job seeker's list. The AI plan suggests some, a counsellor can recommend others;
// the person accepts each one before it counts as assigned ("My assigned courses").
entity AssignedCourses : cuid, managed {
  caseFile   : Association to CaseFiles;
  owner      : String(60);     // job seeker username (empty for a guest case)
  course     : Association to Courses;
  source     : String(12);     // ai, counsellor
  assignedBy : String(100);    // "SkillSetu AI" or "Meera (meera.ccp)"
  note       : String(500);    // why: the plan it belongs to, or the counsellor's personal note
  skill      : String(100);    // the skill gap it closes
  status     : String(12) default 'suggested';  // suggested, accepted, declined, done
}

// Sign-in with username and password; counsellor usernames end in "ccp".
// secret is a salted scrypt hash, never the password itself. Not exposed through any service.
entity Accounts {
  key username    : String(60);
      displayName : String(100);
      role        : String(12);    // user, counsellor
      secret      : String(200);
}

entity Sessions {
  key token     : String(64);
      username  : String(60);
      role      : String(12);
      expiresAt : Timestamp;
}
