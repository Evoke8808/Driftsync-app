namespace skillsetu;

using { cuid, managed } from '@sap/cds/common';

// Company data a partner employer shares with SkillSetu (entered in the Company portal, read by agents over the Company MCP).
entity Companies : cuid, managed {
  name   : String(100);
  domain : String(100);   // work email domain, e.g. servicefirst.in: an account with this email belongs to the company
  about  : String(500);
}

entity CompanyEmployees : cuid, managed {
  company    : Association to Companies;
  email      : String(200);
  name       : String(100);
  title      : String(100);
  department : String(100);
  years      : Integer;
  skills     : String(500);    // skill names from SkillSetu's catalog, comma separated
  projects   : LargeString;    // one project per line: "Name: what they did"
}

entity CompanyPostings : cuid, managed {
  company     : Association to Companies;
  title       : String(100);
  department  : String(100);
  location    : String(100);
  description : String(1000);
  skills      : String(500);   // skill names from SkillSetu's catalog, comma separated
  openings    : Integer default 1;
}

// The work email a job seeker gave at sign-up.
entity AccountEmails {
  key username : String(60);
      email    : String(200);
}

// Consent: a person connected their company data to their SkillSetu case.
entity CompanyLinks : cuid, managed {
  username : String(60);
  caseID   : String(36);
  company  : Association to Companies;
  employee : Association to CompanyEmployees;
}
