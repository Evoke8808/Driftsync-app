"""YouTube video recognition for DriftSync.

Works out WHAT is open on YouTube:
  1. read the tab title and URL straight from the browser (or fall back to the window title)
  2. decide the page kind: a video, a Short, or browsing (home / search / channel)
  3. clean the title ("(3) Dijkstra's Algorithm - YouTube" -> "Dijkstra's Algorithm")
  4. label it with the AI (Groq), or with keyword rules when offline
     -> category, a short use case, and whether it relates to the student's current goal

Used two ways by desktop_app.py:
  - Smart YouTube ON:  videos related to the goal play normally; everything else is blocked
  - Smart YouTube OFF: YouTube is always blocked, and the video is only labelled for analytics
A study video related to the goal counts as "on topic", so it does not lower focus accuracy.
"""
import json
import re
import platform_bridge

CATEGORIES = ["Study", "Music", "Entertainment", "Gaming", "News", "Sports", "Other"]

def read_browser_tab(app_name, timeout=4):
    """Returns (title, url) of the active tab, or ("", "") if the browser can't be asked
    (always the case on Windows; the caller then uses the window title)."""
    return platform_bridge.read_browser_tab(app_name, timeout)


def read_browser_tab_title(app_name, timeout=4):
    return read_browser_tab(app_name, timeout)[0]


def page_kind(url, clean_title):
    """'video', 'shorts' or 'browse' (home, search results, channel, playlist pages)."""
    u = (url or "").lower()
    if u:
        if "/shorts/" in u:
            return "shorts"
        if "/watch" in u or "youtu.be/" in u or "/live/" in u or "/embed/" in u:
            return "video"
        return "browse"
    return "video" if clean_title else "browse"     # no URL available: judge by the title


_YT_SUFFIX = re.compile(r'\s*[-–—|]\s*YouTube(\s+Music)?\s*$', re.IGNORECASE)
# Firefox-style window titles end with the browser name: "Video title - YouTube — Mozilla Firefox"
_BROWSER_SUFFIX = re.compile(r'\s*[-–—]\s*(Mozilla Firefox|Firefox Developer Edition|Zen Browser|Google Chrome|'
                             r'Brave|Microsoft Edge|Opera|Vivaldi|Chromium)(\s+Private Browsing)?\s*$', re.IGNORECASE)
_NOTIF_COUNT = re.compile(r'^\(\d+\)\s*')
_GENERIC = {"", "youtube", "youtube music", "home", "start page", "new tab", "subscriptions", "history",
            "watch later", "library", "shorts", "you"}


def clean_youtube_title(raw_title, app_name=""):
    """Returns the video title, or "" when no specific video is open (home page, search...)."""
    t = (raw_title or "").strip()
    # Safari profiles prefix the window title: "Personal — Video title - YouTube"
    if (app_name or "").strip().lower() in _SAFARI_LIKE:
        m = re.match(r'^([^—]{1,25}) — (.+)$', t)
        if m:
            t = m.group(2).strip()
    t = _BROWSER_SUFFIX.sub('', t)
    t = _NOTIF_COUNT.sub('', t)
    t = _YT_SUFFIX.sub('', t).strip()
    if t.lower() in _GENERIC or t.lower().endswith(" - youtube search") or t.lower().startswith("search"):
        return ""
    return t


def looks_like_youtube(block_item, raw_info=""):
    """True when the matched blocklist item is YouTube itself. A Reddit or Instagram tab that only
    mentions YouTube in its title is handled as that site, not by Smart YouTube."""
    item = (block_item or "").lower()
    return "youtube" in item or "youtu.be" in item


def is_youtube_page(url, raw_title):
    """Checks the page really is YouTube: by the URL host, or (no URL, e.g. Firefox) by the title."""
    if url:
        host = re.sub(r'^[a-z]+://', '', url.strip().lower()).split('/')[0].split(':')[0]
        return host == "youtu.be" or host == "youtube.com" or host.endswith(".youtube.com")
    t = _NOTIF_COUNT.sub('', _BROWSER_SUFFIX.sub('', (raw_title or "").strip())).lower()
    return bool(_YT_SUFFIX.search(t)) or t in ("youtube", "youtube music") or "youtube.com" in t


# ---------- offline rules ----------
_RULES = [
    ("Study", "Lecture or tutorial", r"lecture|tutorial|explained|explanation|course|lesson|class \d|chapter|how to solve|"
                                     r"crash course|full course|for beginners|in \d+ minutes|nptel|khan academy|freecodecamp|"
                                     r"\bdsa\b|algorithm|data structure|calculus|physics|chemistry|biology|maths?\b|"
                                     r"programming|python|java\b|javascript|c\+\+|sql|dbms|operating system|computer network|"
                                     r"exam|revision|one shot|important questions|pyq|gate\b|jee\b|neet\b|interview prep|leetcode"),
    ("Music", "Music", r"\blofi\b|lo-fi|official (music )?video|lyrics?\b|\bsong\b|album|playlist|\bremix\b|audio\b|beats\b|"
                       r"jukebox|\bft\.|feat\."),
    ("Gaming", "Gaming video", r"gameplay|gaming|walkthrough|minecraft|valorant|bgmi|pubg|fortnite|gta\b|let'?s play|speedrun"),
    ("Sports", "Sports highlights", r"highlights|\bipl\b|cricket|football|\bnba\b|\bf1\b|match\b|\bvs\.? .* (live|highlights)"),
    ("News", "News", r"\bnews\b|breaking|headlines|live updates|debate|press conference"),
    ("Entertainment", "Entertainment", r"vlog|prank|reaction|react|funny|comedy|meme|shorts|trailer|episode|podcast|"
                                       r"challenge|unboxing|review\b|movie|web ?series|stand ?up"),
]


_STOP = {"i", "am", "the", "a", "an", "and", "of", "to", "for", "in", "on", "my", "studying", "study", "learn",
         "learning", "solve", "solving", "do", "doing", "work", "working", "with", "some", "two", "problem",
         "explained", "minute", "video", "tutorial", "lecture", "part", "full", "course"}
_EXPAND = {"dsa": "data structure algorithm", "dbms": "database sql", "cn": "network", "os": "operating system process",
           "oops": "object oriented", "dp": "dynamic programming", "ml": "machine learning", "ai": "artificial intelligence"}


def _stem(w):
    # "studies" -> "study", "classes" -> "class", "boxes" -> "box", "queues" -> "queue", "trees" -> "tree"
    if len(w) <= 4 or not w.endswith("s") or w.endswith(("ss", "us")):
        return w
    if w.endswith("ies"):
        return w[:-3] + "y"
    if w.endswith(("sses", "xes", "zes", "ches", "shes")):
        return w[:-2]
    return w[:-1]


def _words(text):
    out = set()
    for w in re.findall(r"[a-z0-9+#]+", (text or "").lower()):
        for part in _EXPAND.get(w, w).split():
            part = _stem(part)
            if part not in _STOP and len(part) > 2:
                out.add(part)
    return out


def _goal_words(goal):
    return _words(goal)


def rule_classify(title, goal=""):
    t = (title or "").lower()
    category, use_case = "Other", "General video"
    for cat, label, pattern in _RULES:
        if re.search(pattern, t):
            category, use_case = cat, label
            break
    shared = _goal_words(goal) & _words(t)
    related = category == "Study" and bool(shared)
    return {"category": category, "use_case": use_case, "related_to_goal": related}


# ---------- AI ----------
SYSTEM_PROMPT = (
    "You label YouTube videos for a study focus app. Given the video title and the student's current goal, "
    'reply ONLY with JSON: {"category": one of ' + json.dumps(CATEGORIES) + ', '
    '"use_case": "<what the video is, at most 6 words>", "related_to_goal": true or false}. '
    "related_to_goal is true only when watching this video directly helps with the goal. "
    "Music, entertainment and gaming are never related to a study goal."
)


def ai_classify(title, goal, llm_call):
    """llm_call(messages) -> str. Raises on network/API errors so the caller can fall back to rules."""
    raw = llm_call([
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": f"Goal: {goal or 'not set'}\nVideo title: {title}"},
    ])
    obj = json.loads(raw[raw.find('{'):raw.rfind('}') + 1])
    category = str(obj.get("category", "Other")).strip().title()
    if category not in CATEGORIES:
        category = "Other"
    use_case = str(obj.get("use_case") or category).strip()[:60]
    related = bool(obj.get("related_to_goal")) and category == "Study"
    return {"category": category, "use_case": use_case, "related_to_goal": related}


_cache = {}

BROWSING = {"category": "Browsing", "use_case": "YouTube home or search, no video open",
            "related_to_goal": False, "on_topic": False, "source": "rules"}


NOT_YOUTUBE = {"category": "Other", "use_case": "Not a YouTube page",
               "related_to_goal": False, "on_topic": False, "source": "rules"}


def analyse(app_name, window_title, goal, llm_call=None, tab=None):
    """Full pipeline. Always returns a dict (with 'kind': video, shorts, browse, or other when
    the page isn't YouTube at all); never raises.
    tab: an already-read (title, url) pair, to avoid asking the browser twice."""
    tab_title, url = tab if tab is not None else read_browser_tab(app_name)
    if not is_youtube_page(url, tab_title or window_title):
        return {"title": "", "kind": "other", **NOT_YOUTUBE}
    title = clean_youtube_title(tab_title, app_name) or clean_youtube_title(window_title, app_name)
    kind = page_kind(url, title)
    if kind == "browse" or not title:
        return {"title": "", "kind": "browse", **BROWSING}
    if kind == "shorts":
        return {"title": title, "kind": "shorts", "category": "Entertainment", "use_case": "YouTube Shorts",
                "related_to_goal": False, "on_topic": False, "source": "rules"}
    return {"kind": "video", **classify_title(title, goal, llm_call)}


def classify_title(title, goal, llm_call=None):
    """Labels one video title; results are cached per (title, goal)."""
    key = (title.lower(), (goal or "").lower())
    if key in _cache:
        return dict(_cache[key], cached=True)

    result, source = None, "rules"
    if llm_call:
        try:
            result, source = ai_classify(title, goal, llm_call), "ai"
        except Exception as e:
            print(f"[VIDEO INSIGHT] AI unavailable, using rules: {e}", flush=True)
    if result is None:
        result = rule_classify(title, goal)

    out = {"title": title, **result, "on_topic": bool(result["related_to_goal"]), "source": source}
    if source == "ai" or not llm_call:   # rule results after an AI failure are retried next time
        _cache[key] = out
    return out
