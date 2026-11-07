const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const TIMEOUT_MS = 18000;     // one AI step, all retries included
const ATTEMPT_MS = 7000;      // one call to one model
const COOLDOWN_MS = 30000;    // after the AI fails completely, use rules for 30s so the chat stays fast
const readJson = (f) => { try { return JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8')); } catch { return null; } };

/* ---------- Debug log (no secrets). Shows why the AI failed without digging through the terminal. ---------- */
const LOG_FILE = path.join(ROOT, 'ai-debug.log');
const redact = (s) => String(s).replace(/AIza[0-9A-Za-z_\-]{10,}/g, '[key]').replace(/key=[^&\s]+/gi, 'key=[key]');
function debug(line) {
  try {
    fs.appendFileSync(LOG_FILE, `${new Date().toISOString()} ${redact(line).slice(0, 600)}\n`);
    if (fs.statSync(LOG_FILE).size > 200000) {
      const lines = fs.readFileSync(LOG_FILE, 'utf8').trim().split('\n');
      fs.writeFileSync(LOG_FILE, lines.slice(-400).join('\n') + '\n');
    }
  } catch { /* logging must never break the app */ }
}

// A short reason a person can read in the agent trace.
function shortReason(e) {
  const m = String(e?.message || e || '');
  if (e?.status === 503 || /high demand|overloaded|unavailable/i.test(m)) return 'Gemini is overloaded right now';
  if (e?.status === 429 || /quota|rate limit|exhausted/i.test(m)) return 'Gemini free quota or rate limit reached';
  if (/api key/i.test(m)) return 'Gemini rejected the API key';
  if (e?.status === 403) return 'Gemini access denied';
  if (/no answer within|timeout|time budget/i.test(m)) return 'Gemini did not answer in time';
  if (/fetch failed|ENOTFOUND|ECONN|network/i.test(m)) return 'No connection to Gemini';
  return m.slice(0, 100);
}

/* ---------- Provider 1: SAP AI Core / Generative AI Hub ---------- */
// Key from aicore-key.json (git-ignored) locally, or the aicore service binding on BTP.
// A copied template still says "PASTE ... HERE", so it doesn't count as a key.
const aicoreKey = readJson('aicore-key.json');
const realKey = aicoreKey && aicoreKey.clientid && !/PASTE/.test(JSON.stringify(aicoreKey));
if (!process.env.AICORE_SERVICE_KEY && realKey) process.env.AICORE_SERVICE_KEY = JSON.stringify(aicoreKey);
const sdkInstalled = (() => { try { require.resolve('@sap-ai-sdk/orchestration'); return true; } catch { return false; } })();
const AICORE_MODEL = process.env.SKILLSETU_MODEL || 'anthropic--claude-4.5-haiku';
let aicoreClient;

const aicore = {
  name: 'SAP Generative AI Hub',
  model: AICORE_MODEL,
  configured() {
    if (!sdkInstalled) return false;   // run "npm install" to add the SAP AI SDK
    if (process.env.AICORE_SERVICE_KEY) return true;
    try { return !!JSON.parse(process.env.VCAP_SERVICES || '{}').aicore; } catch { return false; }
  },
  async complete(system, user, temperature = 0) {
    if (!aicoreClient) {
      const { OrchestrationClient } = require('@sap-ai-sdk/orchestration');
      aicoreClient = new OrchestrationClient({
        promptTemplating: {
          model: { name: AICORE_MODEL, params: { temperature: 0.2, max_tokens: 1500 } },
          prompt: { template: [{ role: 'system', content: '{{?system}}' }, { role: 'user', content: '{{?user}}' }] }
        }
      }, { resourceGroup: process.env.AICORE_RESOURCE_GROUP || 'default' });
    }
    const call = aicoreClient.chatCompletion({ placeholderValues: { system, user } });
    const res = await Promise.race([call, new Promise((_, rej) => setTimeout(() => rej(new Error('no answer within time budget')), TIMEOUT_MS))]);
    return res.getContent();
  }
};

/* ---------- Provider 2: Google Gemini (free tier via AI Studio) ---------- */
// Key from gemini-key.json (git-ignored): { "apiKey": "...", "model": "optional model id" }
const geminiCfg = readJson('gemini-key.json') || {};
const GEMINI_KEY = String(process.env.GEMINI_API_KEY || geminiCfg.apiKey || '').trim();
const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta';
// Google retired the 1.x/2.x models for new keys (they answer 404). On 2026-10-30 the big 3.x Flash models were
// overloaded (no answer in 15s) while gemini-3.5-flash-lite answered in about 1.5s, so that is the default.
const PREFERRED = 'gemini-3.5-flash-lite';
const RETIRED = /^gemini-(1\.|2\.0|2\.5)/;
const configuredModel = String(process.env.GEMINI_MODEL || geminiCfg.model || PREFERRED).trim();
let geminiModel = RETIRED.test(configuredModel) ? PREFERRED : configuredModel;

async function geminiFetch(url, body, ms = ATTEMPT_MS) {
  let res;
  try {
    res = await fetch(url, {
      method: body ? 'POST' : 'GET',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_KEY },
      body: body && JSON.stringify(body),
      signal: AbortSignal.timeout(ms)
    });
  } catch (e) {
    const err = new Error(e.name === 'TimeoutError' ? `no answer within ${Math.round(ms / 1000)}s` : (e.cause?.code || e.message));
    err.retry = true;
    throw err;
  }
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const e = new Error(json.error?.message || `Gemini HTTP ${res.status}`);
    e.status = res.status;
    // Busy, rate-limited, missing or unsupported models are worth trying on another model. A bad key is not.
    e.retry = [404, 429, 500, 503, 504].includes(res.status) || (res.status === 400 && !/api key/i.test(e.message));
    throw e;
  }
  return json;
}

// Flash models this key can call, best first: fast "lite" models, then newer versions. Looked up once, only when needed.
// Google keeps retired models in the list but answers 404 for new keys, so 404s are remembered in `dead`.
let flashModels = null;
const dead = new Set();
const version = (n) => parseFloat((n.match(/gemini-(\d+(\.\d+)?)/) || [])[1]) || 0;
const rank = (n) => (/lite/.test(n) ? 100 : 0) + version(n) * 10 - (/preview/.test(n) ? 50 : 0) - (/latest/.test(n) ? 5 : 0)
  - (/omni/.test(n) ? 200 : 0) - (RETIRED.test(n) ? 300 : 0);
async function listFlashModels() {
  if (flashModels) return flashModels;
  const { models = [] } = await geminiFetch(`${GEMINI_BASE}/models?pageSize=200`, null, 6000);
  flashModels = models
    .filter((m) => (m.supportedGenerationMethods || []).includes('generateContent'))
    .map((m) => m.name.replace(/^models\//, ''))
    .filter((n) => /flash/.test(n) && !/(image|tts|audio|live|thinking|exp|native)/.test(n))
    .sort((a, b) => rank(b) - rank(a));
  return flashModels;
}

// Google's 404 for a retired model names the replacement: "...use models/gemini-3.8-flash...".
const suggestedModel = (msg) => (String(msg).match(/use models\/([\w.\-]+)/) || [])[1] || null;

// Next model to try: Google's suggestion first, then the best live model not tried yet.
async function nextModel(tried, hint) {
  if (hint && !tried.includes(hint) && !dead.has(hint)) return hint;
  let pool = [PREFERRED, 'gemini-flash-lite-latest', 'gemini-flash-latest'];
  try {
    const live = await listFlashModels();
    if (live.length) pool = live;
  } catch (e) { debug(`list models failed status=${e.status || '-'} ${e.message}`); }
  return pool.find((n) => !tried.includes(n) && !dead.has(n)) || null;
}

// Thinking eats time and output tokens; keep it minimal for short JSON answers.
// Gemini 2.5 takes a token budget, Gemini 3+ takes a level. If a model refuses the setting we retry without it.
function thinkingFor(model) {
  if (/gemini-2\.5-flash/.test(model)) return { thinkingBudget: 0 };
  if (/gemini-([3-9]|\d\d)/.test(model) || /latest/.test(model)) return { thinkingLevel: 'low' };
  return null;
}
const noThinking = new Set();   // models that rejected the thinking setting
const geminiBody = (model, system, user, temperature) => {
  const thinking = noThinking.has(model) ? null : thinkingFor(model);
  return {
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: 'user', parts: [{ text: user }] }],
    generationConfig: { temperature, maxOutputTokens: 2048, responseMimeType: 'application/json', ...(thinking ? { thinkingConfig: thinking } : {}) }
  };
};
const generateUrl = (model) => `${GEMINI_BASE}/models/${model}:generateContent`;

// One call to one model. Retries once without the thinking setting if the model rejects it.
async function generate(model, system, user, temperature, ms) {
  try {
    return await geminiFetch(generateUrl(model), geminiBody(model, system, user, temperature), ms);
  } catch (e) {
    if (e.status === 400 && /thinking/i.test(e.message) && !noThinking.has(model)) {
      noThinking.add(model);
      debug(`${model} rejected the thinking setting, retrying without it`);
      return geminiFetch(generateUrl(model), geminiBody(model, system, user, temperature), ms);
    }
    throw e;
  }
}

const gemini = {
  name: 'Google Gemini',
  get model() { return geminiModel; },
  configured: () => !!GEMINI_KEY,
  async complete(system, user, temperature = 0, log = console) {
    const deadline = Date.now() + TIMEOUT_MS;
    const tried = [];
    let last, hint = null;
    for (let i = 0; i < 4; i++) {
      const left = deadline - Date.now();
      if (left < 2500) break;
      const model = i === 0 && !dead.has(geminiModel) ? geminiModel : await nextModel(tried, hint);
      if (!model) break;
      tried.push(model);
      const t0 = Date.now();
      try {
        const json = await generate(model, system, user, temperature, Math.min(ATTEMPT_MS, left));
        const cand = json.candidates?.[0];
        const text = (cand?.content?.parts || []).filter((p) => !p.thought).map((p) => p.text || '').join('');
        if (!text.trim()) {
          const e = new Error(`empty answer (${cand?.finishReason || json.promptFeedback?.blockReason || 'no reason given'})`);
          e.retry = true;
          throw e;
        }
        debug(`ok ${model} ${Date.now() - t0}ms`);
        if (model !== geminiModel) {
          log.info(`Gemini: now using ${model} (${geminiModel} did not work)`);
          debug(`switched ${geminiModel} -> ${model}`);
          geminiModel = model;
        }
        return text;
      } catch (e) {
        last = e;
        debug(`fail ${model} after ${Date.now() - t0}ms status=${e.status || '-'} ${e.message}`);
        log.warn(`Gemini ${model}: ${e.message}`);
        if (e.status === 404) { dead.add(model); hint = suggestedModel(e.message); }
        if (!e.retry) throw e;
      }
    }
    throw last || new Error('no answer within time budget');
  }
};

/* ---------- Chain: SAP first, then Gemini; the agents fall back to rules ---------- */
const PROVIDERS = [aicore, gemini];

// Pull the first JSON object or array out of a model reply (models sometimes wrap it in ``` fences or prose).
function parseJson(content) {
  const text = String(content || '').replace(/```(json)?/g, '').trim();
  const starts = [text.indexOf('{'), text.indexOf('[')].filter((i) => i >= 0);
  if (!starts.length) throw new Error('No JSON in AI reply');
  const start = Math.min(...starts);
  const end = text[start] === '{' ? text.lastIndexOf('}') : text.lastIndexOf(']');
  return JSON.parse(text.slice(start, end + 1));
}

const cooldown = {};   // provider name -> { until, reason }

// Any agent: ask for JSON, trying each configured provider in order.
// Returns { data, provider, model, ms }, or null (the agent then uses its rules). Pass `info` to learn why it was null.
async function askJson(system, user, { log = console, temperature = 0, info } = {}) {
  const ready = PROVIDERS.filter((x) => x.configured());
  if (!ready.length) { if (info) info.error = 'no AI key set up'; return null; }
  for (const p of ready) {
    const pause = cooldown[p.name];
    if (pause && pause.until > Date.now()) {
      if (info) info.error = `${pause.reason}; AI paused for ${Math.ceil((pause.until - Date.now()) / 1000)}s`;
      continue;
    }
    const t0 = Date.now();
    let content;
    try {
      content = await p.complete(system, user, temperature, log);
    } catch (e) {
      const reason = shortReason(e);
      cooldown[p.name] = { until: Date.now() + COOLDOWN_MS, reason };
      if (info) info.error = reason;
      debug(`${p.name} gave up after ${Date.now() - t0}ms: ${e.message}`);
      log.warn(`${p.name} failed (${reason}), using rules for ${COOLDOWN_MS / 1000}s. Details: ${e.message}`);
      continue;
    }
    try {
      delete cooldown[p.name];
      return { data: parseJson(content), provider: p.name, model: p.model, ms: Date.now() - t0 };
    } catch {
      // The AI answered, just not in JSON. Not an outage, so no pause.
      if (info) info.error = 'AI answer was not in the expected format';
      debug(`not JSON from ${p.model}: ${String(content).slice(0, 200)}`);
      log.warn(`${p.name} answered, but not in JSON`);
    }
  }
  return null;
}

/* ---------- Self-check when the server starts (at most every 30 minutes, to save free quota) ---------- */
const CHECK = 'check v4';
function lastCheckAge() {
  try {
    const line = fs.readFileSync(LOG_FILE, 'utf8').trim().split('\n').reverse().find((l) => l.includes(` ${CHECK}: done`));
    return line ? Date.now() - Date.parse(line.slice(0, 24)) : Infinity;
  } catch { return Infinity; }
}
async function selfCheck() {
  if (lastCheckAge() < 30 * 60 * 1000) return;
  const say = (m) => debug(`${CHECK}: ${m}`);
  if (!GEMINI_KEY) { say('no Gemini key found (gemini-key.json "apiKey" or GEMINI_API_KEY)'); say('done'); return; }
  say(`model in config: ${configuredModel}, using: ${geminiModel}`);
  const t0 = Date.now();
  try {
    const json = await generate(geminiModel, 'Return JSON only: {"ok":true}', 'ping', 0, 15000);
    say(`${geminiModel} answered in ${Date.now() - t0}ms: ${(json.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('').slice(0, 40)}`);
  } catch (e) {
    say(`${geminiModel} failed after ${Date.now() - t0}ms status=${e.status || '-'} ${e.message.slice(0, 200)}`);
  }
  say('done');
}
if (process.env.SKILLSETU_AI_CHECK !== 'off') setTimeout(() => selfCheck().catch((e) => debug(`${CHECK}: crashed ${e.message}`)), 1500).unref();

/* ---------- Web search: Gemini with Google Search grounding ---------- */
// Answers with live Google Search results and returns the web pages it used, so every fact has a source.
let groundingOffUntil = 0;   // the free Gemini tier has no Google Search quota: after a quota error, skip it for 30 min
async function webSearch(system, question, { log = console, info } = {}) {
  if (!GEMINI_KEY) { if (info) info.error = 'no Gemini key'; return null; }
  if (Date.now() < groundingOffUntil) { if (info) info.error = 'Google Search via Gemini needs a paid Gemini plan'; return null; }
  const models = [...new Set([geminiModel, PREFERRED, 'gemini-flash-latest', 'gemini-flash-lite-latest'])].filter((m) => !dead.has(m));
  const t0 = Date.now();
  let last;
  for (const model of models.slice(0, 3)) {
    try {
      const json = await geminiFetch(`${GEMINI_BASE}/models/${model}:generateContent`, {
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text: question }] }],
        tools: [{ google_search: {} }],
        generationConfig: { temperature: 0.2 }
      }, 15000);
      const cand = json.candidates?.[0];
      const text = (cand?.content?.parts || []).map((p) => p.text || '').join('').trim();
      if (!text) throw Object.assign(new Error('empty answer'), { retry: true });
      const meta = cand.groundingMetadata || {};
      const seen = new Set();
      const sources = (meta.groundingChunks || []).map((c) => c.web).filter((w) => w?.uri && !seen.has(w.title) && seen.add(w.title))
        .slice(0, 6).map((w) => ({ title: w.title || 'Source', url: w.uri }));
      return { text, sources, queries: meta.webSearchQueries || [], provider: 'Google Search via Gemini', model, ms: Date.now() - t0 };
    } catch (e) {
      last = e;
      if (e.status === 404) dead.add(model);
      if (e.status === 429 && /quota/i.test(e.message)) { groundingOffUntil = Date.now() + 30 * 60e3; break; }
      log.warn?.(`Web search with ${model}: ${e.message}`);
      if (!e.retry) break;
    }
  }
  if (info) info.error = last ? String(last.message).slice(0, 120) : 'no answer';
  return null;
}

module.exports = { askJson, webSearch };
