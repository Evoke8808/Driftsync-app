// Sign-in for SkillSetu. Two portals with their own pages: job seekers and counsellors.
// Everyone uses a username and password; counsellor usernames end in "ccp". A session token travels in the X-SkillSetu-Token header.
const cds = require('@sap/cds');
const crypto = require('crypto');

const SESSION_HOURS = 12;
const isCounsellorName = (u) => /ccp$/i.test(String(u || '').trim());
const clean = (u) => String(u || '').trim().toLowerCase();
const tables = () => cds.entities('skillsetu');

function hash(secret, salt = crypto.randomBytes(16).toString('hex')) {
  return `scrypt$${salt}$${crypto.scryptSync(String(secret), salt, 32).toString('hex')}`;
}
function verify(secret, stored) {
  const [, salt, h] = String(stored || '').split('$');
  if (!salt || !h) return false;
  const a = Buffer.from(hash(secret, salt).split('$')[2], 'hex'), b = Buffer.from(h, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

class AuthError extends Error { constructor(status, code, message) { super(message); this.status = status; this.code = code; } }

async function newSession(acc) {
  const { Sessions } = tables();
  const token = crypto.randomBytes(32).toString('hex');
  await INSERT.into(Sessions).entries({ token, username: acc.username, role: acc.role, expiresAt: new Date(Date.now() + SESSION_HOURS * 3600e3).toISOString() });
  return { token, username: acc.username, displayName: acc.displayName || acc.username, role: acc.role };
}

// portal: 'user' or 'counsellor'. Each portal only accepts its own kind of account.
async function login({ username, secret, portal }) {
  const u = clean(username);
  if (!u || !secret) throw new AuthError(400, 'MISSING', 'Enter your username and password');
  if (portal !== 'counsellor' && isCounsellorName(u)) throw new AuthError(409, 'USE_COUNSELLOR_LOGIN', 'This is a counsellor account. Please use the counsellor sign-in.');
  if (portal === 'counsellor' && !isCounsellorName(u)) throw new AuthError(409, 'USE_USER_LOGIN', 'Counsellor usernames end in "ccp". Job seekers sign in on the main page.');
  const acc = await SELECT.one.from(tables().Accounts).where({ username: u });
  if (!acc || !verify(secret, acc.secret)) throw new AuthError(400, 'BAD_LOGIN', 'Wrong username or password');
  return newSession(acc);
}

// Create an account from the sign-up form of either portal. Counsellor usernames must end in "ccp",
// and a "ccp" username can't be made from the job seeker page.
async function register({ username, displayName, secret, portal }) {
  const u = clean(username), counsellor = portal === 'counsellor';
  if (!/^[a-z0-9._-]{3,30}$/.test(u)) throw new AuthError(400, 'BAD_USERNAME', 'Usernames are 3 to 30 letters or numbers (dots, dashes and underscores are fine).');
  if (counsellor && !isCounsellorName(u)) throw new AuthError(400, 'NEEDS_CCP', 'Counsellor usernames must end in "ccp", for example meera.ccp');
  if (!counsellor && isCounsellorName(u)) throw new AuthError(400, 'RESERVED', 'Usernames ending in "ccp" are for counsellors. Use the counsellor sign-up instead.');
  if (String(secret || '').length < 6) throw new AuthError(400, 'WEAK_PASSWORD', 'Use a password of at least 6 characters.');
  const { Accounts } = tables();
  if (await SELECT.one.from(Accounts).where({ username: u })) throw new AuthError(409, 'TAKEN', 'That username is taken. Try another one.');
  const acc = { username: u, displayName: String(displayName || '').trim().slice(0, 100) || u, role: counsellor ? 'counsellor' : 'user', secret: hash(secret) };
  await INSERT.into(Accounts).entries(acc);
  return newSession(acc);
}

// The signed-in account for an HTTP request, or null for a guest. Calls from inside the server (no HTTP) are trusted.
async function who(req) {
  const http = req.http?.req;
  if (!http) return { internal: true, role: 'counsellor' };
  const token = http.headers['x-skillsetu-token'];
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const s = await SELECT.one.from(tables().Sessions).where({ token });
  if (!s || new Date(s.expiresAt) < new Date()) return null;
  const acc = await SELECT.one.from(tables().Accounts).columns('username', 'displayName', 'role').where({ username: s.username });
  return acc || null;
}

async function logout(req) {
  const token = req.http?.req?.headers['x-skillsetu-token'];
  if (token) await DELETE.from(tables().Sessions).where({ token });
}

module.exports = { login, register, who, logout, hash, verify, isCounsellorName, AuthError };
