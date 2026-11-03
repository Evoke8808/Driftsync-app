// Web search for the Web Research agent, through an official search API (no scraping).
// Uses Tavily (built for AI agents, free tier) when a key is set: TAVILY_API_KEY, or web-search-key.json { "tavilyApiKey": "..." }.
const fs = require('fs');
const path = require('path');

const keyFile = () => { try { return JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'web-search-key.json'), 'utf8')); } catch (e) { return {}; } };
const tavilyKey = () => String(process.env.TAVILY_API_KEY || keyFile().tavilyApiKey || '').trim();

async function search(query, { max = 5 } = {}) {
  const key = tavilyKey();
  if (!key) return { error: 'no web search key' };
  const t0 = Date.now();
  try {
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({ query: String(query).slice(0, 380), max_results: max, search_depth: 'advanced', chunks_per_source: 3, topic: 'general', include_answer: 'basic' }),
      signal: AbortSignal.timeout(12000)
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return { error: body.detail?.error || body.error || `search answered ${res.status}` };
    const results = (body.results || []).map((r) => ({ title: String(r.title || r.url).slice(0, 140), url: r.url, content: String(r.content || '').slice(0, 900) }));
    return { results, answer: typeof body.answer === 'string' ? body.answer.trim() : '', provider: 'Tavily web search', ms: Date.now() - t0 };
  } catch (e) {
    return { error: e.name === 'TimeoutError' ? 'web search did not answer in time' : e.message };
  }
}

module.exports = { search, enabled: () => !!tavilyKey() };
