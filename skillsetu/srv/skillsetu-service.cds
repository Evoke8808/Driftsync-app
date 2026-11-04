using { skillsetu as db } from '../db/schema';
using from '../db/company';

service SkillSetuService @(path: '/api') {

  // The catalog is read-only over the API; only the agents write (case files, chat, audit trail).
  @readonly entity Skills as projection on db.Skills;
  @readonly entity Roles as projection on db.Roles;
  @readonly entity RoleSkills as projection on db.RoleSkills;
  @readonly entity Courses as projection on db.Courses;
  @readonly entity Candidates as projection on db.Candidates;
  @readonly entity CaseFiles as projection on db.CaseFiles;
  @readonly entity ChatMessages as projection on db.ChatMessages;
  @readonly entity AuditLog as projection on db.AuditLog;
  @readonly entity Outbox as projection on db.Outbox;

  // Sign-in. portal is "user" (job seeker) or "counsellor" (username ending in "ccp"). Everyone uses a password.
  // Returns JSON { token, username, displayName, role }. Send the token back in the X-SkillSetu-Token header.
  action login(username: String, secret: String, portal: String) returns String;
  action register(username: String, displayName: String, secret: String, portal: String, email: String) returns String;
  // The partner company that matches the signed-in job seeker's work email, and whether this case is connected (JSON).
  function companyMatch(caseID: String) returns String;
  action logout() returns String;
  function me() returns String;

  // The single front door. The orchestrator routes each message to one or two of the six agents.
  // intent/roleID come from buttons in the chat; message is free text. Returns JSON { caseID, replies, trace, suggestions, caseFile }.
  // name is optional: only the counsellor sees it, employers only see the case ID.
  action chat(caseID: String, message: String, intent: String, roleID: String, name: String) returns String;

  // Human-in-the-loop: a counsellor approves a case or asks for changes.
  action reviewCase(caseID: String, decision: String, note: String) returns String;

  // One case with its chat and audit trail (JSON), and the list of cases for the counsellor screen.
  function caseView(caseID: String) returns String;
  function cases() returns String;
  // Name, ID and status for a list of case IDs (the person's own chat history on this device).
  function myCases(ids: String) returns String;

  // Counsellor desk: hand an approved case to SAP SuccessFactors Recruiting, and the push history.
  action sendToSuccessFactors(caseID: String, roleID: String) returns String;
  function sfPushes(caseID: String) returns String;
  // Counsellor / employer tool: four-fifths rule audit of a résumé filter vs skills-first screening for one job (JSON).
  function biasAudit(roleID: String) returns String;

  // Impact dashboard: live numbers from real cases plus district pilot figures (synthetic, labelled).
  function impact() returns String;

  // After-hire and job-risk watch: scan every watched case for better matches, risk warnings and due check-ins.
  // days lets a demo jump ahead in time (e.g. 30 = "as if a month has passed"). Returns JSON { scanned, alerts }.
  action runWatch(days: Integer) returns String;
  // Counsellor marks a case as hired into a role (default: the case's target role). Starts the after-hire companion.
  action markHired(caseID: String, roleID: String) returns String;
  // The messages the watch would have emailed (demo outbox). caseID optional.
  function outbox(caseID: String) returns String;

  // My assigned courses. AI plan suggestions plus counsellor recommendations; the person accepts each one.
  // myCourses: a signed-in job seeker gets their own list; a guest passes the case IDs this device remembers.
  function myCourses(ids: String) returns String;
  // decision: accept, decline or done.
  action respondCourse(id: String, decision: String) returns String;
  // Counsellor only: a personal course recommendation for one case, the case's course list, and taking one back.
  action recommendCourse(caseID: String, courseID: String, note: String) returns String;
  function caseCourses(caseID: String) returns String;
  action withdrawCourse(id: String) returns String;
}
