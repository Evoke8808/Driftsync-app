// Company portal service: only signed-in counsellors can read or change company data.
const cds = require('@sap/cds');
const auth = require('./auth');

module.exports = class CompanyService extends cds.ApplicationService {
  init() {
    this.before('*', async (req) => {
      const u = await auth.who(req);
      if (u?.role !== 'counsellor') return req.reject(401, 'Only a signed-in counsellor can open the company portal.');
    });
    // Tidy what people type: lower-case domains and emails, no "@" in a domain.
    this.before(['CREATE', 'UPDATE'], 'Companies', (req) => { if (req.data.domain) req.data.domain = String(req.data.domain).trim().toLowerCase().replace(/^.*@/, ''); });
    this.before(['CREATE', 'UPDATE'], 'Employees', (req) => { if (req.data.email) req.data.email = String(req.data.email).trim().toLowerCase(); });
    return super.init();
  }
};
