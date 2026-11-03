// Agent: Web Research. Looks things up on the live web (salaries in a city, companies hiring, schemes, news, courses)
// and answers with the sources it used, so every fact can be checked. First choice: Gemini with Google Search;
// otherwise a web search API (Tavily) whose results the AI summarises. Without either, it says so honestly.
const ai = require('../ai');
const web = require('../integrations/web-search');
const { label, isHindi } = require('./lib');

const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return ''; } };

module.exports = {
  id: 'research',
  name: 'Web Research',
  icon: '🌐',
  describe: 'Searches the live web for current, real-world facts SkillSetu’s own data does not have: salaries in a city, which companies are hiring, government schemes and support, news and trends, details of a course or employer. Answers with source links.',

  async run(ctx) {
    const { cf, message, log, aiInfo } = ctx;
    const hi = isHindi(cf, message);
    const question = String(message || '').trim();
    const about = [cf.skills.length && `skills: ${cf.skills.map((s) => label(s.skill)).join(', ')}`, cf.prefs?.location && `city: ${cf.prefs.location}`,
      cf.district && `district: ${cf.district}`].filter(Boolean).join('; ');
    const lang = /[ऀ-ॿ]/.test(question) ? 'Hindi in Devanagari script' : 'English';
    const SYSTEM = 'You are the Web Research agent of SkillSetu, a career service in India. Answer the person\'s question from the search results only, ' +
      `in ${lang}, in 3 to 5 short sentences. Prefer facts about India and the person's city if given. Give numbers only if a source states them. ` +
      'If the results do not answer the question, say so plainly. No praise or filler.';

    // 1) Gemini with Google Search grounding.
    let out = await ai.webSearch(SYSTEM, `${about ? `About the person (${about}).\n` : ''}Question: ${question}`, { log, info: aiInfo });
    // 2) A search API, summarised by the AI from the results it returned.
    if (!out) {
      const found = await web.search(`${question}${/india|भारत/i.test(question) ? '' : ' India'}`);
      if (found.results?.length) {
        const res = await ai.askJson(SYSTEM + ' Return JSON only: {"answer":"<your answer>"}',
          `${about ? `About the person (${about}).\n` : ''}Question: ${question}\n\nSearch results:\n` +
          found.results.map((r, i) => `[${i + 1}] ${r.title} (${host(r.url)}): ${r.content}`).join('\n'), { log, temperature: 0.2, info: aiInfo });
        const answer = typeof res?.data?.answer === 'string' ? res.data.answer.trim() : '';
        out = { text: answer || `I found ${found.results.length} pages about this. The sources are below.`, sources: found.results.map((r) => ({ title: r.title, url: r.url })),
          provider: found.provider + (res ? ` + ${res.provider}` : ''), model: res?.model || null, ms: found.ms + (res?.ms || 0) };
      } else if (found.error && aiInfo && !aiInfo.error) aiInfo.error = found.error;
    }

    if (!out) {
      return {
        replies: [{ text: hi ? 'अभी मैं वेब पर खोज नहीं कर पा रही हूँ। तब तक मैं SkillSetu के डेटा और SAP की खुली नौकरियों से मदद कर सकती हूँ।'
          : 'I can’t search the web right now. Meanwhile I can help from SkillSetu’s own data and the open jobs in SAP SuccessFactors.' }],
        note: `web search unavailable${aiInfo?.error ? `: ${aiInfo.error}` : ''}`,
        suggestions: [{ label: hi ? 'मेरे लिए नौकरियाँ दिखाओ' : 'Show jobs that fit me', intent: 'market' }]
      };
    }
    const sources = out.sources.map((s) => ({ ...s, site: host(s.url) }));
    return {
      replies: [{ text: out.text.slice(0, 1200), card: sources.length ? { type: 'web', sources, provider: out.provider } : null }],
      note: `searched the web: ${sources.length} source(s)${out.queries?.length ? ` for "${out.queries[0]}"` : ''}`,
      ai: { provider: out.provider.slice(0, 60), model: out.model, ms: out.ms },
      suggestions: [{ label: hi ? 'मेरे लिए नौकरियाँ दिखाओ' : 'Show jobs that fit me', intent: 'market' }, { label: hi ? 'मेरा सीखने का प्लान बनाओ' : 'Make my learning plan', intent: 'pathway' }]
    };
  }
};
