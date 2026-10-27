# How DriftSync Works

This guide explains what happens when you use DriftSync, from signing in to the dashboard. For setup and install steps, see [README.md](README.md).

## The big picture

DriftSync is a desktop window (built with PyWebView) that shows HTML pages from this folder. Behind it runs a background thread, the **radar**, that checks which window is in front every 1.5 seconds. When you're in a focus session and the front window matches an item on your blocklist, DriftSync pops up an intention check (the "friction" screen) and logs the event.

Everything is stored locally in `focusguard.db` (SQLite). The only network calls go to Groq, and only for the AI Coach, the AI Timetable and Smart YouTube, and only if you set a `GROQ_API_KEY`.

## Step by step

1. **Sign in or register** (`login.html`). Passwords are hashed with PBKDF2 and a random salt before they're stored.
2. **Set up a session** (`setup.html`). You choose:
   - your goal for the session,
   - a persona (Corporate, College or School), which sets how strict the blocking is,
   - the session length,
   - a blocklist of apps and sites, such as Instagram, Reddit or YouTube.
   - You can also generate a multi-day study plan here with the AI Timetable.
3. **Focus timer** (`index.html`). The timer runs a focus block, then a short break, repeating like a Pomodoro cycle. Pauses are limited based on the strictness you chose. The AI Coach panel can chat with you about what's getting in the way.
4. **The radar watches your front window** (`desktop_app.py`, `monitor_loop`). It only runs during a focus block, and only when the blocklist is not empty. On each check it reads the frontmost app and window title. `platform_bridge.py` handles this differently on macOS (AppleScript) and Windows (Win32 via ctypes).
5. **When something on the blocklist is in front**, the radar decides whether to block it:
   - If it's a normal blocked app or site, the friction screen (`friction.html`) appears straight away.
   - If it's YouTube and **Smart YouTube** is on, it checks the video first (see below).
6. **The friction screen** asks you to type your goal again to unlock. Typing it correctly starts a grace period of the length you chose (set by the minutes in the intention check). If you don't, the app stays blocked. The radar then waits a few seconds before it can pop up again.
7. **The drift is logged** in the `drifts` table. The same app is logged only once per minute, so staying on Instagram doesn't flood the log with rows.
8. **The dashboard** (`dashboard.html`) reads the saved sessions and drift events and shows weekly focus charts, session accuracy, distraction breakdowns and history.

## Smart YouTube

YouTube is a mix of study and distraction, so it gets its own logic (`video_insight.py`).

- `platform_bridge.py` reads the active browser tab's title and URL (macOS can read Safari and Chromium browsers this way, while Windows reads the window title only).
- The page is classed as a video, a Short, or a home or search page.
- Home and search pages are allowed for 90 seconds per focus block (30 seconds in demo mode), so you can find something to study.
- Videos are labelled by AI through Groq, or by keyword rules if no key is set. A video related to your goal plays normally. Shorts, off-topic videos and unclear ones are blocked, and the popup shows what was recognised.
- Turning Smart YouTube off means YouTube is always blocked. The video still gets a label for the dashboard.

## The AI parts

| Feature | Module | Model (Groq) | Works offline? |
| :--- | :--- | :--- | :--- |
| AI Coach chat | `desktop_app.py` (`COACH_PROMPT`) with `coach_patterns.py` | `openai/gpt-oss-20b` | Yes, a pattern-based reply is used |
| AI Timetable | `timetable_ai.py` | `openai/gpt-oss-120b` | Yes, the offline planner is used |
| Smart YouTube labels | `video_insight.py` | `VIDEO_MODEL`, defaults to the coach model | Yes, keyword rules are used |

Without `GROQ_API_KEY`, the coach stays offline, and the timetable and video labels fall back to the offline options.

## Settings and environment

These are read from `.env` at startup:

- `GROQ_API_KEY`: turns on the AI features.
- `DEMO_MODE=1`: shortens focus blocks, breaks and grace periods for reviews.
- `COACH_MODEL` and `VIDEO_MODEL`: optional model overrides.

## Key constants (`desktop_app.py`)

| Constant | Default | What it controls |
| :--- | :--- | :--- |
| `SCAN_INTERVAL_SEC` | 1.5 s | How often the radar checks the front window |
| `REARM_COOLDOWN_SEC` | 4 s | Wait before the friction screen can pop up again |
| `DRIFT_DEDUPE_SEC` | 60 s | Window in which the same app is logged only once |
| `MIN_VALID_FOCUS_SEC` | 300 s (30 s in demo) | Shorter focus blocks are logged as invalid |
| `BROWSE_ALLOWANCE_SEC` | 90 s (30 s in demo) | YouTube browsing time per focus block |

## Files

- `desktop_app.py`: the backend. It holds the API bridge, the SQLite manager, the radar and the friction window.
- `platform_bridge.py`: OS-specific window detection, permissions, and bringing apps to the front or hiding them.
- `video_insight.py`: Smart YouTube page detection and labels.
- `coach_patterns.py`: the library of study blockers the coach recognises.
- `timetable_ai.py`: the study planner.
- `login.html`, `setup.html`, `index.html`, `friction.html`, `timetable.html`, `dashboard.html`, `grace.html`: the screens.
- `theme.css`: shared styles.
- `dashboard_live.html`: a live copy of the dashboard that the app writes from the saved data.
- `DriftSync.bat` and `DriftSync.command`: launchers for Windows and macOS.
