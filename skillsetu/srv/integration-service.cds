// SkillSetu Integration API (v1): plain REST + JSON for HR systems, job portals and NGO case tools
// (SAP SuccessFactors, Workday, a government skilling portal...). Every call needs the header x-api-key.
// Docs: /api-docs.html (Swagger UI). Machine-readable spec: /openapi.json
using { skillsetu as db } from '../db/schema';

@protocol: 'rest'
@path: '/integration/v1'
@Core.Description: 'SkillSetu Integration API: turn life stories into verified skills, get fair job matches, learning plans and bias reports.'
service IntegrationService {

  type SkillEvidence {
    skill    : String;   // skill name, e.g. budget-management
    label    : String;   // readable name, e.g. Budget management
    evidence : String;   // the words from the story that prove it
    foundBy  : String;   // ai | keywords
  }
  type CaseSummary {
    caseID      : String;
    code        : String;   // short ID shown to people, e.g. SS-4F2A1C (employers see only this)
    name        : String;
    status      : String;   // active | sent | approved | changes
    externalRef : String;
    skills      : many SkillEvidence;
    targetRole  : String;
    plan        : { role: String; courses: Integer; hours: Integer; weeks: Integer; };
    messages    : many String;   // what the agents replied in this call
  }
  type JobMatch {
    roleID         : String;
    title          : String;
    company        : String;
    location       : String;
    salary         : String;
    type           : String;
    matchPercent   : Integer;
    matchedSkills  : many String;
    missingSkills  : many String;
    demand         : String;
    automationRisk : String;
  }
  type PlanStep { skill: String; course: String; provider: String; url: String; duration: String; level: String; }
  type LearningPlan { role: String; matchToday: Integer; totalHours: Integer; weeks: Integer; steps: many PlanStep; }
  type GroupResult { group: String; applicants: Integer; resumeFilterRate: Decimal; resumeFilterAIR: Decimal; skillsFirstRate: Decimal; skillsFirstAIR: Decimal; }
  type FairnessReport {
    role : String; threshold : Decimal;
    resumeFilterFailingGroups : Integer; skillsFirstFailingGroups : Integer;
    qualified : Integer; qualifiedRejectedByResumeFilter : Integer;
    groups : many GroupResult;
  }
  type ReadinessReport {
    caseID : String; role : String; matchPercent : Integer;
    filterBarriers : many String;   // what a typical résumé filter would reject this person for
    tips : many String;
    audit : FairnessReport;
  }
  type Webhook { id: String; url: String; events: many String; secret: String; lastStatus: String; }
  type SFPushResult { caseID: String; code: String; role: String; jobReqId: String; candidateId: String; applicationId: String; matchPercent: Integer; status: String; target: String; }

  // 1. Create a case from a person's story (any language). Runs Skills Discovery and returns the skills with evidence.
  action createCase(story: String, name: String, externalRef: String, district: String) returns CaseSummary;
  // 2. Add more of the story, or answer the follow-up question, for an existing case.
  action addToCase(caseID: String, text: String) returns CaseSummary;
  // 3. Read a case (skills, plan, counsellor status).
  function getCase(caseID: String) returns CaseSummary;
  // 4. Skills-first job matches for a case. Optional filters: partTime, remote, city.
  function getMatches(caseID: String, partTime: Boolean, remote: Boolean, city: String) returns many JobMatch;
  // 5. The shortest free course plan to a role (default: the best match).
  function getLearningPlan(caseID: String, roleID: String) returns LearningPlan;
  // 6. Bias and readiness report for a case: résumé-filter barriers, tips and the four-fifths audit.
  function getReadiness(caseID: String) returns ReadinessReport;
  // 7. Four-fifths-rule fairness audit for any role (no case needed).
  function getFairnessAudit(roleID: String) returns FairnessReport;
  // 8. Send a case to a human counsellor. Nothing reaches an employer before a counsellor approves.
  action submitForReview(caseID: String) returns CaseSummary;
  // 9. Hand an approved candidate to SAP SuccessFactors Recruiting (Candidate + JobApplication). Name is not shared.
  action pushToSuccessFactors(caseID: String, roleID: String) returns SFPushResult;
  // 10. Webhooks: SkillSetu POSTs JSON to your URL on case.approved, case.changes_requested, case.disputed.
  action registerWebhook(url: String, events: many String) returns Webhook;
  function listWebhooks() returns many Webhook;
  action deleteWebhook(id: String) returns Boolean;

  // Read-only catalog for syncing into your own systems.
  @readonly entity Roles as projection on db.Roles excluding { requiredSkills };
  @readonly entity Skills as projection on db.Skills;
  @readonly entity Courses as projection on db.Courses;
}
