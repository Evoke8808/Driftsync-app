using { sfmock } from '../db/sf-mock';

// Read-only view of what SkillSetu sent to "SuccessFactors" in demo mode: /sf-mock/JobApplication
@path: '/sf-mock'
@readonly
service SuccessFactorsMock {
  entity Candidate as projection on sfmock.Candidate;
  entity JobRequisition as projection on sfmock.JobRequisition;
  entity JobApplication as projection on sfmock.JobApplication;
}
