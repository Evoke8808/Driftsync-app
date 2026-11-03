// A small subset of the SAP SuccessFactors Recruiting OData API (Candidate, JobRequisition, JobApplication),
// enough for SkillSetu to hand over approved candidates. With no tenant configured, `cds watch` serves this
// as an in-process mock, so the demo works offline. With a BTP destination (see package.json, profile
// [production]), the same code talks to a real SuccessFactors tenant.
@cds.external
service SFRecruiting {
  entity Candidate {
    key candidateId : String(40);
    firstName           : String(100);
    lastName            : String(100);
    primaryEmail        : String(200);
    country             : String(3);
    cust_skillsetuCode  : String(20);    // SkillSetu case ID; the person stays anonymous until they agree
    cust_skills         : String(1000);  // verified skills with evidence, comma separated
  }
  entity JobRequisition {
    key jobReqId : String(40);
    jobCode      : String(60);
    jobTitle     : String(200);
    location     : String(100);
    status       : String(30);
  }
  entity JobApplication {
    key applicationId    : String(40);
    candidateId          : String(40);
    jobReqId             : String(40);
    status               : String(30);   // e.g. Applied
    source               : String(60);   // SkillSetu
    cust_matchPercent    : Integer;
    cust_fairnessChecked : Boolean;      // passed SkillSetu's four-fifths audit and a counsellor's review
    cust_counsellorNote  : String(1000);
  }
}
