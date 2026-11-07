// Stand-in for an SAP SuccessFactors Recruiting tenant during the demo: same entity and field names
// as srv/external/SFRecruiting.cds. With a real tenant configured, SkillSetu writes there instead.
namespace sfmock;

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

