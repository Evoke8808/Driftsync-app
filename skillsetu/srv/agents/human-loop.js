// Agent 6: Human-in-the-Loop. Not an AI. Hands the case to a human counsellor, records disputes
// against the AI, and reports the counsellor's decision back. Nothing goes to an employer without a person's OK.
const { label, keywordSkills, isHindi } = require('./lib');

// "I don't know Excel": the person is the authority on their own skills, so the skill comes off the file at once.
const DENIES = /don[’']?t know|do not know|don[’']?t have|never (used|done|did)|can[’']?t|cannot|not good at|no idea|नहीं आता|नहीं आती|नहीं जानत|नहीं किया|nahi aata|nahi aati/i;
const DISPUTE = /don[’']?t know|do not know|never (used|done|did)|dispute|wrong|disagree|not true|galat|appeal|incorrect|mistake|गलत|ग़लत|गलती|सही नहीं|नहीं आता/i;

module.exports = {
  id: 'human',
  name: 'Human-in-the-Loop',
  icon: '🧑‍⚖️',
  describe: 'Sends the plan to a human counsellor for approval, lets the person dispute an AI decision, and reports the counsellor’s decision. Use for approval, counsellor, human review, disputes, complaints about the AI, or status of the review.',

  async run(ctx) {
    const { cf, cat, message, roleID } = ctx;
    const dispute = DISPUTE.test(message || '');
    // "Apply through counsellor" on a job: that job becomes the target, and goes to SAP SuccessFactors once approved.
    const applyRole = !dispute && roleID && cat?.roles.find((r) => r.ID === roleID);
    if (applyRole && cf.targetRole_ID !== applyRole.ID) {
      cf.targetRole_ID = applyRole.ID;
      if (cf.plan && cf.plan.roleID !== applyRole.ID) cf.plan = null;   // the old plan was for another job
      if (cf.status === 'approved' || cf.status === 'changes') cf.status = 'active';   // a new job needs a new review
    }

    if (!dispute && (cf.status === 'approved' || cf.status === 'changes')) {
      const ok = cf.status === 'approved';
      return {
        replies: [{ text: ok ? 'Good news: your counsellor approved your plan.' : 'Your counsellor asked for a change before approving.',
          card: { type: 'handoff', status: cf.status, note: cf.counsellorNote, plan: summary(cf) } }],
        note: `reported ${cf.status}`, suggestions: []
      };
    }

    cf.status = 'sent';
    if (dispute) cf.counsellorNote = null;
    const hi = isHindi(cf, message);
    let removed = [];
    if (dispute && DENIES.test(message)) {
      const named = new Set(keywordSkills(message).map((k) => k.skill));
      const low = String(message).toLowerCase();
      removed = cf.skills.filter((s) => named.has(s.skill) || low.includes(label(s.skill).toLowerCase())).map((s) => s.skill);
      cf.skills = cf.skills.filter((s) => !removed.includes(s.skill));
      if (removed.length) cf.plan = null;   // the plan was built on those skills
    }
    const gone = removed.map(label).join(', ');
    const removedText = !removed.length ? '' : hi ? ` मैंने ${gone} आपके हुनर से हटा दिया है, इसलिए नौकरियाँ और प्लान अब इसके बिना बनेंगे।` : ` I’ve removed ${gone} from your skills, so jobs and plans no longer count it.`;
    const flagged = hi ? 'मैंने यह एक काउंसलर (इंसान) को भेज दिया है। वे आपका संदेश, AI की वजह और पूरा रिकॉर्ड देखेंगे, और AI का फ़ैसला बदल सकते हैं।'
      : 'I’ve flagged this for a human counsellor. They’ll see your message, the AI’s reasoning and the full trace, and they can overrule the AI.';
    const sent = hi ? 'आपका प्लान एक काउंसलर को भेज दिया गया है। वे इसे जाँचकर आपको यहीं जवाब देंगे। शुभकामनाएँ!'
      : 'Your plan has been sent to a counsellor. They’ll check it and reply to you right here. Good luck!';
    const noPlan = hi ? ' आपने अभी कोई प्लान नहीं बनाया है, इसलिए काउंसलर पहले सही नौकरी चुनने में मदद करेंगे।'
      : ' You don’t have a learning plan yet, so they’ll first help you pick the right job.';
    const applyText = !applyRole ? '' : hi ? ` आवेदन: ${applyRole.title} (${applyRole.company})। काउंसलर की मंज़ूरी के बाद यह SAP SuccessFactors में जाएगा, आपके नाम के बिना।`
      : ` Applying for ${applyRole.title} (${applyRole.company}): once the counsellor approves, the application goes to SAP SuccessFactors, without your name.`;
    const text = dispute ? (removedText.trim() ? removedText.trim() + ' ' : '') + flagged : sent + (applyRole ? applyText : cf.plan ? '' : noPlan);
    return {
      replies: [{ text, card: { type: 'handoff', status: 'sent', dispute: dispute ? String(message).slice(0, 300) : null, removed: removed.map(label), plan: summary(cf, applyRole) } }],
      note: dispute ? (removed.length ? `dispute recorded, removed ${gone}` : 'dispute recorded') : applyRole ? `sent to counsellor to apply for ${applyRole.title}` : 'sent to counsellor',
      disputed: dispute ? String(message).slice(0, 300) : null,
      suggestions: []
    };
  }
};

const summary = (cf, role) => ({
  skills: cf.skills.map((s) => label(s.skill)),
  role: cf.plan?.roleTitle || role?.title || null,
  courses: cf.plan?.steps?.length ?? null,
  hours: cf.plan?.totalHours ?? null
});
