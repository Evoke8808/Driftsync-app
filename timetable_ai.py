import os, json, ssl, urllib.request, urllib.error
from datetime import datetime, timedelta

GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
GROQ_MODEL = "openai/gpt-oss-120b"

SYSTEM_PROMPT = (
    "You are an elite academic study planner. Reply with ONLY a valid JSON object, no markdown code blocks, no prose, in this exact shape: "
    '{"days":[{"label":"Day 1 - Module name","slots":[{"time":"3:00-5:00 PM","task":"..."}]}],'
    '"tips":["..."]}. '
    "Rules: one entry in days per day until the exam, plus a final light-revision entry for exam day. "
    "Each day has 5-9 slots with realistic clock times, includes breaks/meals, ends with a short recap "
    "and an early sleep time. Spread modules across days, give heavier modules more time, put a full "
    "revision of all modules on the last study day, and never start new topics on exam day."
)

def build_user_prompt(subject, modules, days, hours, start_time):
    return (f"Subject: {subject}\nModules: {', '.join(modules)}\n"
            f"Days until exam: {days}\nStudy hours per day: {hours}\n"
            f"First day starts at: {start_time}")

def parse_timetable(text):
    """Extract + validate the JSON the model returned. Raises ValueError if unusable."""
    start, end = text.find("{"), text.rfind("}")
    if start == -1 or end <= start:
        raise ValueError("no JSON found")
    data = json.loads(text[start:end + 1])
    days = data.get("days")
    if not isinstance(days, list) or not days:
        raise ValueError("missing days")
    clean = []
    for d in days:
        slots = [{"time": str(s.get("time", "")).strip(), "task": str(s.get("task", "")).strip()}
                 for s in d.get("slots", []) if isinstance(s, dict) and s.get("task")]
        if not slots:
            raise ValueError("day without slots")
        clean.append({"label": str(d.get("label", "Day")).strip(), "slots": slots})
    tips = [str(t) for t in data.get("tips", []) if t][:5] if isinstance(data.get("tips"), list) else []
    return {"days": clean, "tips": tips}

def _ssl_context():
    try:
        import certifi
        return ssl.create_default_context(cafile=certifi.where())
    except Exception:
        return ssl.create_default_context()

def call_groq(system_prompt, user_prompt, api_key, opener=None):
    body = json.dumps({
        "model": GROQ_MODEL,
        "temperature": 0.7,
        "max_completion_tokens": 8192,   # includes reasoning; long plans need room
        "reasoning_effort": "medium",
        "response_format": {"type": "json_object"},
        "messages": [{"role": "system", "content": system_prompt},
                     {"role": "user", "content": user_prompt}],
    }).encode()

    req = urllib.request.Request(GROQ_URL, data=body, headers={
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        # Groq sits behind Cloudflare, which blocks Python's default urllib user-agent (403, error 1010)
        "User-Agent": "DriftSync/1.0",
    })

    open_fn = opener or (lambda r: urllib.request.urlopen(r, timeout=60, context=_ssl_context()))
    with open_fn(req) as resp:
        res_data = json.loads(resp.read().decode())
        return res_data["choices"][0]["message"]["content"]

_BASE_DAY = datetime(1900, 1, 1).date()   # the date strptime gives the parsed start time

def _fmt(t):
    s = t.strftime('%I:%M %p').lstrip('0')
    return s + " (next day)" if t.date() > _BASE_DAY else s


def _slot(start, minutes, task):
    return {"time": f"{_fmt(start)} - {_fmt(start + timedelta(minutes=minutes))}", "task": task}


def generate_smart_timetable(subject, modules, days, hours, start_time_str):
    """Deterministic offline planner, used when Groq is unavailable.
    - `days` study days, then a light exam-day entry (same shape the Groq prompt asks for)
    - each study day holds about `hours` of 50-minute blocks with 10-minute breaks and a meal break
    - modules rotate across all blocks so every module is covered; the last study day revises everything
    """
    raw = (start_time_str or "").strip().upper()
    parsed_time = None
    for fmt in ("%I:%M %p", "%I:%M%p", "%H:%M", "%I %p"):
        try:
            parsed_time = datetime.strptime(raw, fmt)
            break
        except ValueError:
            continue
    if parsed_time is None:
        if raw:
            raise ValueError("Couldn't read the start time. Use a format like 9:00 AM.")
        parsed_time = datetime.strptime("09:00 AM", "%I:%M %p")

    clean_modules = [m.strip() for m in modules if m and m.strip()]
    if not clean_modules:
        clean_modules = ["Core Concepts", "Problem Solving", "Mock Assessment"]
    subject = (subject or "").strip() or "your subject"

    try:
        num_days = max(1, min(int(days), 14))
    except (TypeError, ValueError):
        num_days = 3
    try:
        num_hours = max(1.0, min(float(hours), 12.0))
    except (TypeError, ValueError):
        num_hours = 6.0

    BLOCK, SHORT_BREAK, MEAL_BREAK, RECAP = 50, 10, 45, 20
    blocks_per_day = max(1, round(num_hours * 60 / BLOCK))
    has_revision_day = num_days >= 2
    learning_days = num_days - 1 if has_revision_day else num_days

    seen = set()
    pointer = 0
    days_data = []

    for d in range(1, num_days + 1):
        revision = has_revision_day and d == num_days
        curr = parsed_time
        slots, todays_modules = [], []

        for b in range(blocks_per_day):
            mod = clean_modules[pointer % len(clean_modules)]
            pointer += 1
            if mod not in todays_modules:
                todays_modules.append(mod)

            if revision:
                task = f"Revision: {mod} (key points + past questions)"
                if b == blocks_per_day - 1 and blocks_per_day > 1:
                    task = f"Timed Mock Test: full {subject} syllabus"
            elif mod not in seen:
                task = f"Learn: {mod} (concepts, notes, worked examples)"
                seen.add(mod)
            else:
                task = f"Practice: {mod} (solve problems, check solutions)"

            slots.append(_slot(curr, BLOCK, task))
            curr += timedelta(minutes=BLOCK)

            if b == blocks_per_day - 1:
                break
            if (b + 1) % 3 == 0:
                label = "Meal Break • Step away from screens" if b + 1 == 3 else "Long Break • Snack & a short walk"
                slots.append(_slot(curr, MEAL_BREAK, label))
                curr += timedelta(minutes=MEAL_BREAK)
            else:
                slots.append(_slot(curr, SHORT_BREAK, "Short Break • Water & stretch"))
                curr += timedelta(minutes=SHORT_BREAK)

        slots.append(_slot(curr, RECAP, "Daily Recap • Note weak areas for tomorrow"))

        shown = ", ".join(todays_modules[:2]) + (f" +{len(todays_modules) - 2} more" if len(todays_modules) > 2 else "")
        label = f"Day {d} - Full Revision & Mock" if revision else f"Day {d} - {shown}"
        days_data.append({"label": label, "slots": slots})

    # Exam day: light review only, no new topics
    curr = parsed_time
    exam_slots = []
    for minutes, gap, task in [
        (40, 20, f"Quick flashcard & formula sheet review ({subject})"),
        (20, 10, "Short Break • Breathe, hydrate, relax"),
        (30, 15, "Skim your weak-area notes once (no new topics)"),
        (20, 0, "Pack hall ticket & stationery • Head out early"),
    ]:
        exam_slots.append(_slot(curr, minutes, task))
        curr += timedelta(minutes=minutes + gap)
    days_data.append({"label": "Exam Day - Light Review Only", "slots": exam_slots})

    tips = [
        "Use active recall: close your notes and write key concepts from memory before checking.",
        "Keep breaks off-screen; a 10-minute walk beats 10 minutes of scrolling.",
        "Never start a completely new topic the evening before the exam.",
        "Solve at least 2 questions per module without looking at the solutions.",
    ]
    if learning_days * blocks_per_day < len(clean_modules):
        tips.insert(0, "Not every module fits in this time. Add days or hours per day to cover them all.")

    return {"days": days_data, "tips": tips[:5]}


def make_timetable(subject, modules, days, hours, start_time, api_key=None, caller=call_groq):
    # Set it in the terminal before launching:  export GROQ_API_KEY="gsk_..."
    active_key = api_key or os.environ.get("GROQ_API_KEY", "")
    modules = [m.strip() for m in modules if m and m.strip()]
    if not modules:
        return {"success": False, "message": "Add at least one module."}

    prompt = build_user_prompt(subject or "General", modules, days, hours, start_time)

    # Try Groq AI if a key is present
    if active_key:
        try:
            raw_output = caller(SYSTEM_PROMPT, prompt, active_key)
            return {"success": True, "timetable": parse_timetable(raw_output),
                    "source": "Groq Reasoning Engine"}
        except Exception as e:
            print(f"[TIMETABLE AI] Groq fallback triggered: {e}", flush=True)

    # Instant resilient fallback
    try:
        schedule = generate_smart_timetable(subject, modules, days, hours, start_time)
        return {"success": True, "timetable": schedule, "source": "Offline Smart Planner"}
    except Exception as e:
        return {"success": False, "message": f"Planning error: {str(e)}"}
