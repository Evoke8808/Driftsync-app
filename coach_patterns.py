"""Study blocker patterns for the DriftSync AI Coach.

Each pattern has:
  label    the name shown to the student as a tag
  group    which family it belongs to
  signals  words/phrases that usually point to it (English + common Hinglish)
  why      one-line, normalising explanation of why it happens
  step     a small first action the coach can offer
  minutes  default timer length for that first step

The same list is used two ways:
  1. build_pattern_guide() turns it into the reference the LLM reads in its system prompt.
  2. offline_coach_reply() uses the signals for keyword matching when the LLM is unreachable.
"""
import re

PATTERNS = [
    # ---------- Avoidance & motivation ----------
    {"label": "Procrastination", "group": "Avoidance",
     "signals": ["later", "tomorrow", "postpone", "postponing", "putting it off", "keep delaying", "delay",
                 "last minute", "kal se", "baad mein", "can't start", "cant start", "not starting", "procrastinat"],
     "why": "it is usually the brain avoiding an uncomfortable feeling about the task, not laziness",
     "step": "Do only the first 5 minutes of the task", "minutes": 10},
    {"label": "Task Overwhelm", "group": "Avoidance",
     "signals": ["too much", "so much", "overwhelm", "huge syllabus", "whole syllabus", "don't know where to start",
                 "dont know where to start", "where do i start", "so many chapters", "backlog", "pile up", "piled up"],
     "why": "a big, vague task feels threatening, so the brain freezes instead of choosing a first step",
     "step": "Pick one subtopic and list 3 things in it", "minutes": 10},
    {"label": "Low Motivation", "group": "Avoidance",
     "signals": ["don't feel like", "dont feel like", "no motivation", "unmotivated", "not motivated", "lazy",
                 "no energy to study", "what's the point", "whats the point", "mann nahi", "man nahi", "no mood"],
     "why": "motivation usually shows up after you start, not before, so waiting for it rarely works",
     "step": "Start with the easiest problem in the chapter", "minutes": 15},
    {"label": "Perfectionism", "group": "Avoidance",
     "signals": ["perfect", "rewrite my notes", "rewriting notes", "redo", "not good enough", "has to be right",
                 "start over", "starting over", "beautiful notes", "neat notes", "aesthetic notes"],
     "why": "high standards make starting feel risky, so polishing replaces actual progress",
     "step": "Write a rough, messy first pass of one topic", "minutes": 20},
    {"label": "Boredom", "group": "Avoidance",
     "signals": ["boring", "bored", "dull", "monotonous", "hate this subject", "uninteresting", "so dry"],
     "why": "the brain craves novelty, and repetitive material gives it very little reward",
     "step": "Turn the topic into 5 quiz questions and answer them", "minutes": 20},

    # ---------- Digital distraction ----------
    {"label": "Phone Checking", "group": "Digital distraction",
     "signals": ["phone", "mobile", "notification", "notifications", "keep checking", "pick up my phone",
                 "screen time", "unlock my phone"],
     "why": "phones are designed to give quick, unpredictable rewards, which makes checking almost automatic",
     "step": "Put the phone in another room and study one topic", "minutes": 25},
    {"label": "Social Media Scrolling", "group": "Digital distraction",
     "signals": ["instagram", "insta", "reels", "shorts", "youtube", "scroll", "scrolling", "doomscroll",
                 "tiktok", "snapchat", "twitter", "reddit", "one video", "just one video", "feed"],
     "why": "endless feeds are built to keep you watching, and 'just one more' is exactly how they work",
     "step": "Close the app and do one focused study block", "minutes": 25},
    {"label": "Chatting & Messages", "group": "Digital distraction",
     "signals": ["whatsapp", "texting", "chatting", "messages", "group chat", "discord", "replying to friends",
                 "friends keep messaging", "dm"],
     "why": "social replies feel urgent and rewarding, so each message pulls attention away",
     "step": "Mute chats and study until the timer ends", "minutes": 25},
    {"label": "Gaming Urge", "group": "Digital distraction",
     "signals": ["game", "gaming", "valorant", "bgmi", "pubg", "minecraft", "fortnite", "one match", "play games"],
     "why": "games give fast, clear rewards that studying can't match in the moment",
     "step": "Study first, and use one match as the reward after", "minutes": 30},
    {"label": "Tab Hopping & Multitasking", "group": "Digital distraction",
     "signals": ["multitask", "multitasking", "many tabs", "switching", "switch tasks", "jump between",
                 "doing many things", "too many tabs"],
     "why": "every switch costs focus, so the brain never settles into deep work",
     "step": "Keep one tab open and finish one task", "minutes": 25},

    # ---------- Attention & environment ----------
    {"label": "Mind Wandering", "group": "Attention",
     "signals": ["zone out", "zoning out", "daydream", "mind wanders", "mind keeps wandering", "same line",
                 "same page again", "can't concentrate", "cant concentrate", "lose focus", "losing focus",
                 "distracted easily", "focus nahi", "dhyan nahi"],
     "why": "attention naturally drifts every few minutes, especially with passive reading",
     "step": "Read one page, then write 3 lines from memory", "minutes": 15},
    {"label": "Noisy Environment", "group": "Environment",
     "signals": ["noise", "noisy", "loud", "family keeps", "interrupt", "interrupted", "roommate", "siblings",
                 "people talking", "can't study at home", "ghar pe"],
     "why": "the brain keeps scanning sounds and interruptions, which drains focus",
     "step": "Use earphones or move spots, then do one block", "minutes": 25},
    {"label": "Studying in Bed", "group": "Environment",
     "signals": ["in bed", "on the bed", "lying down", "bed pe", "fall asleep while studying", "sleepy while studying"],
     "why": "the brain links the bed with rest, so studying there makes you drowsy",
     "step": "Move to a desk and do one short block", "minutes": 20},

    # ---------- Poor study habits ----------
    {"label": "Passive Studying", "group": "Study habits",
     "signals": ["reread", "re-read", "rereading", "highlight", "highlighting", "just reading",
                 "read but forget", "forget everything", "don't remember", "dont remember", "doesn't stick"],
     "why": "rereading feels productive but creates an illusion of knowing; recall is what makes it stick",
     "step": "Close the book and write everything you remember", "minutes": 15},
    {"label": "Productive Procrastination", "group": "Study habits",
     "signals": ["organizing", "organising", "clean my desk", "making a timetable", "make a plan", "planning instead",
                 "colour coding", "color coding", "setting up notion", "arranging", "decorating notes"],
     "why": "planning and tidying feel like progress, so they quietly replace the hard work",
     "step": "Stop planning and solve one real question", "minutes": 20},
    {"label": "Tutorial Hell", "group": "Study habits",
     "signals": ["watching lectures", "watch videos", "tutorial", "tutorials", "lecture after lecture",
                 "only watching", "can't solve on my own", "cant solve on my own", "understand but can't solve"],
     "why": "watching someone else solve feels like learning, but skill only builds when you try it yourself",
     "step": "Solve one problem without watching anything", "minutes": 25},
    {"label": "Cramming", "group": "Study habits",
     "signals": ["cram", "cramming", "all nighter", "all-nighter", "night before", "exam tomorrow",
                 "one night", "stay up all night"],
     "why": "panic studying feels efficient, but memory needs spacing and sleep to hold on",
     "step": "Review the 5 highest-weight topics only", "minutes": 25},
    {"label": "No Breaks", "group": "Study habits",
     "signals": ["hours without break", "no break", "non stop", "nonstop", "marathon", "studying for hours",
                 "6 hours straight", "head hurts", "brain fried"],
     "why": "focus fades after long stretches, so more hours stop giving more learning",
     "step": "Do one focused block, then take a real break", "minutes": 25},
    {"label": "Long Breaks", "group": "Study habits",
     "signals": ["break became", "break turned into", "5 minute break", "never come back", "can't get back",
                 "cant get back", "break too long", "long break", "after break"],
     "why": "open-ended breaks drift into something more rewarding, so returning feels hard",
     "step": "Restart with a short block right now", "minutes": 15},
    {"label": "Lack of Clarity", "group": "Study habits",
     "signals": ["don't know what to study", "dont know what to study", "what should i study", "confused what",
                 "no plan", "unclear", "which topic", "kya padhu"],
     "why": "without a clear next action, the brain stalls and looks for something easier",
     "step": "Write down one specific task for the next session", "minutes": 10},
    {"label": "Stuck on a Problem", "group": "Study habits",
     "signals": ["stuck", "can't solve", "cant solve", "too hard", "don't understand", "dont understand",
                 "doesn't make sense", "doesnt make sense", "frustrated", "frustrating"],
     "why": "being stuck is a normal part of learning, and frustration tends to make people quit too early",
     "step": "Re-read the problem and try one smaller case", "minutes": 15},

    # ---------- Energy ----------
    {"label": "Fatigue & Poor Sleep", "group": "Energy",
     "signals": ["tired", "sleepy", "exhausted", "no sleep", "slept late", "didn't sleep", "didnt sleep",
                 "neend", "yawning", "drowsy", "slept 4 hours"],
     "why": "a tired brain has far less focus and memory, so effort feels much harder",
     "step": "Do a light review task, then sleep on time", "minutes": 15},
    {"label": "Energy Dip", "group": "Energy",
     "signals": ["after lunch", "after eating", "afternoon slump", "heavy meal", "hungry", "keep snacking"],
     "why": "energy naturally dips after meals and in the afternoon, it isn't a lack of willpower",
     "step": "Drink water, stretch, then do an easy task", "minutes": 15},
    {"label": "Burnout", "group": "Energy",
     "signals": ["burnout", "burnt out", "burned out", "drained", "for weeks", "can't anymore", "cant anymore",
                 "done with studying", "fed up"],
     "why": "long stretches of pressure without real rest wear down motivation and focus",
     "step": "Do a gentle 10-minute review, then rest properly", "minutes": 10},

    # ---------- Mindset & emotions ----------
    {"label": "Exam Anxiety", "group": "Mindset",
     "signals": ["anxious", "anxiety", "nervous", "panic", "scared of exam", "exam fear", "stress", "stressed",
                 "tension", "pressure", "darr"],
     "why": "the body's stress response is trying to protect you, but too much of it blocks thinking",
     "step": "Take 5 slow breaths, then do one easy question", "minutes": 15},
    {"label": "Fear of Failure", "group": "Mindset",
     "signals": ["fail", "failing", "failure", "what if i fail", "disappoint", "parents expect", "afraid of results"],
     "why": "when results feel tied to your worth, avoiding the task can feel safer than trying",
     "step": "Practise one topic just to learn, not to score", "minutes": 20},
    {"label": "Self-Doubt", "group": "Mindset",
     "signals": ["i'm dumb", "im dumb", "stupid", "not smart", "i can't do this", "i cant do this",
                 "not capable", "everyone understands but me", "bad at"],
     "why": "struggling with hard material feels like a sign you can't do it, but it's how learning feels",
     "step": "Solve one easy question to rebuild momentum", "minutes": 15},
    {"label": "Comparison", "group": "Mindset",
     "signals": ["others are ahead", "friends are ahead", "everyone else", "topper", "compare", "comparing",
                 "they finished", "behind everyone"],
     "why": "you see other people's results but not their struggles, so the comparison is never fair",
     "step": "Do one block on your own plan only", "minutes": 25},
    {"label": "Overthinking", "group": "Mindset",
     "signals": ["overthink", "overthinking", "can't stop thinking", "cant stop thinking", "thoughts",
                 "worried about", "worrying", "racing mind"],
     "why": "an anxious mind keeps replaying worries, which crowds out room for study",
     "step": "Write your worries down, then do one block", "minutes": 15},
]

LABELS = [p["label"] for p in PATTERNS]
_BY_LABEL = {p["label"].lower(): p for p in PATTERNS}


def canonical_label(label):
    """Maps whatever the model returned onto a known label when it is close enough."""
    if not label:
        return None
    key = str(label).strip().lower()
    if key in _BY_LABEL:
        return _BY_LABEL[key]["label"]
    for p in PATTERNS:
        if key in p["label"].lower() or p["label"].lower() in key:
            return p["label"]
    return str(label).strip()[:40]


def build_pattern_guide():
    """Compact reference for the system prompt, grouped by family."""
    lines, current = [], None
    for p in PATTERNS:
        if p["group"] != current:
            current = p["group"]
            lines.append(f"[{current}]")
        hints = ", ".join(p["signals"][:5])
        lines.append(f"- {p['label']}: signs like {hints}. Why: {p['why']}. "
                     f"First step: {p['step']} ({p['minutes']} min).")
    return "\n".join(lines)


def _signal_regex(signal):
    s = re.escape(signal.lower())
    # single words match whole words ("phone" not in "headphones"); phrases match as written
    return re.compile(r'(?<![a-z])' + s + r'(?![a-z])') if " " not in signal else re.compile(s)


_COMPILED = [(p, [_signal_regex(s) for s in p["signals"]]) for p in PATTERNS]


def detect_patterns(text, top=2):
    """Keyword scoring, best matches first. Longer phrases count more than single words."""
    t = " " + (text or "").lower() + " "
    scored = []
    for p, regs in _COMPILED:
        score = sum((2 if " " in sig.pattern.replace("\\ ", " ") else 1) for sig in regs if sig.search(t))
        if score:
            scored.append((score, p))
    scored.sort(key=lambda x: -x[0])
    return [p for _, p in scored[:top]]


GREETING_RE = re.compile(r"^\s*(hi+|hey+|hello+|yo|hii+|good (morning|evening|afternoon)|namaste)\W*\s*$", re.I)
DISTRESS_RE = re.compile(r"(kill myself|suicid|self[- ]?harm|end my life|want to die|hurt myself|no reason to live)", re.I)


def offline_coach_reply(text):
    """Used when the LLM can't be reached: still recognises the blocker and offers a timer."""
    if DISTRESS_RE.search(text or ""):
        return {"issue": "Wellbeing",
                "reply": "I'm really sorry you're feeling this way, and I'm glad you said it. Please reach out to "
                         "someone you trust or a local helpline right now; you don't have to handle this alone.",
                "goal": None, "minutes": None}
    if GREETING_RE.match(text or ""):
        return {"issue": None,
                "reply": "Hey, good to see you. What's getting in the way of studying today?",
                "goal": None, "minutes": None}
    found = detect_patterns(text, top=1)
    if not found:
        return {"issue": None,
                "reply": "I'm offline right now, but I'm still here. Tell me a bit more about what's stopping you, "
                         "for example your phone, feeling tired, or not knowing where to start.",
                "goal": None, "minutes": None}
    p = found[0]
    return {"issue": p["label"],
            "reply": f"That sounds like {p['label'].lower()}, and it's really common: {p['why']}. "
                     f"Let's keep it small: {p['step'][0].lower() + p['step'][1:]}. "
                     f"Want me to start a {p['minutes']}-minute timer?",
            "goal": p["step"], "minutes": p["minutes"]}
