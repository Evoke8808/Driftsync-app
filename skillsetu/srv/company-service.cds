using { skillsetu as db } from '../db/schema';
using from '../db/company';

// Company portal (counsellors and partner admins): add a company, its open postings and its employees.
service CompanyService @(path: '/company-admin') {
  entity Companies as projection on db.Companies;
  entity Employees as projection on db.CompanyEmployees;
  entity Postings  as projection on db.CompanyPostings;
  @readonly entity Links as projection on db.CompanyLinks;
}
