using { skillsetu as db } from '../db/schema';

// OData V4 service for the SAP Fiori Elements counsellor app (app/counsellor-fe). Counsellors only.
// Cases are read-only here: decisions go through the bound actions, which use the same rules as the web app.
service CounsellorService @(path: '/counsellor') {

  @readonly
  entity Cases as projection on db.CaseFiles {
    key ID,
        name,
        status,
        story,
        counsellorNote,
        reviewedBy,
        district,
        externalRef,
        createdAt,
        modifiedAt,
        targetRole.title as targetRole : String(100),
        virtual null as code              : String(20),
        virtual null as statusText        : String(30),
        virtual null as statusCriticality : Integer,
        virtual null as skillCount        : Integer,
        virtual null as skillsText        : LargeString,
        virtual null as planText          : LargeString,
        virtual null as barriersText      : LargeString,
        virtual null as sfText            : String(300),
        messages : redirected to Messages,
        log      : redirected to Trail
  } actions {
    @(Common.SideEffects: { TargetEntities: ['_it'] })
    action approve(note : String(1000) @title: 'Note for the person (optional)')          returns Cases;
    @(Common.SideEffects: { TargetEntities: ['_it'] })
    action requestChanges(note : String(1000) @title: 'What should change?')              returns Cases;
    @(Common.SideEffects: { TargetEntities: ['_it'] })
    action sendToSuccessFactors()                                                          returns Cases;
  };

  @readonly
  entity Messages as projection on db.ChatMessages { key ID, caseFile, seq, role, agent, text, createdAt };

  @readonly
  entity Trail as projection on db.AuditLog { key ID, caseFile, seq, agent, routedBy, reason, provider, model, ms, createdAt };
}
