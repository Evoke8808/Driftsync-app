# DriftSync — Context-Aware Digital Distraction Detection and Focus Recovery System

DriftSync combines a lightweight background monitor with a glassmorphism desktop GUI to enforce intentional computer use, detect task-drift in real time, and help students/professionals rapidly recover focus.

---

## 🚀 Quick Start (Running Natively)

### 1. Navigate to the project directory:
```bash
cd /Users/saikirand/.gemini/antigravity/scratch/driftsync
```
*(Or copy the folder wherever you prefer, e.g. `~/Desktop/driftsync`)*

### 2. Install dependencies:
```bash
pip install -r requirements.txt
```

### 3. Add your API key:
Create a file named `.env` in this folder (it is already git-ignored):
```
GROQ_API_KEY=gsk_your_key_here
```
The AI Coach (`openai/gpt-oss-20b`) and the AI Timetable (`openai/gpt-oss-120b`) both run on Groq with this one key. Without it the timetable uses the offline planner and the coach stays offline.

### 4. Run the application:
```bash
python3 desktop_app.py
```

### Windows

1. Install Python 3.10+ from python.org (tick "Add Python to PATH"). Windows 10/11 already has the Edge WebView2 runtime that the window needs.
2. In the project folder: `pip install -r requirements.txt`
3. Create `.env` with `GROQ_API_KEY=...` (the key file is not shared through git).
4. Double-click **`DriftSync.bat`** (or run `python desktop_app.py`).

No permission popup is needed on Windows. Limitation: Windows can't read a browser tab's URL, so Smart YouTube
uses the window title only (Shorts are detected by title, less reliably than on macOS). All OS-specific code is in `platform_bridge.py`.

> **macOS Note:** When launched, macOS may ask for **Accessibility permissions** (System Settings > Privacy & Security > Accessibility) so the background monitor (`osascript`) can read foreground window titles and intercept distraction apps.

---

## 📁 Project Architecture & Files

| File | Purpose |
| :--- | :--- |
| **`desktop_app.py`** | **Core Backend & Desktop Shell**: PyWebView API bridge, SQLite database manager, background window radar thread, and intent intercept window manager. |
| **`platform_bridge.py`** | **OS layer**: foreground-window detection, permissions, raise/hide app. macOS (AppleScript) and Windows (Win32 via ctypes). |
| **`timetable_ai.py`** | **Groq & Resilient Study Planner**: Generates multi-day cognitive study schedules with breaks, exam recap, and exam strategies. |
| **`login.html`** | **Account Portal**: User sign-in and registration with PBKDF2 + salt password hashing stored in SQLite. |
| **`setup.html`** | **Focus Session Launcher**: Configure active goals, enforcement persona (Corporate, College, School), duration, and custom blocklist items. |
| **`index.html`** | **Active Focus Timer**: Focus → break Pomodoro cycle, pause limits by strictness, and the built-in **AI Coach** (Groq `gpt-oss-20b`). |
| **`friction.html`** | **Intent Intercept Modal**: Pops up instantly when a blocked app/website is detected; forces the user to re-type their goal to unlock and start a grace period. |
| **`timetable.html`** | **Interactive Study Schedule**: Visual schedule timeline with direct **"Focus on this 🎯"** Action Bridge to prime the timer. |
| **`video_insight.py`** | **YouTube Video Recognition**: reads the video title and labels it with AI (or keyword rules offline). |
| **`coach_patterns.py`** | **AI Coach Pattern Library**: 29 study blockers the coach recognises, also used offline. |
| **`theme.css`** | **Calm Focus Theme**: shared colours, buttons and cards for every page. |
| **`dashboard.html`** | **Analytics Dashboard**: Weekly focus charts, session accuracy ring, distraction breakdowns, and historical logs. |
| **`focusguard.db`** | **SQLite Database**: Stores user accounts, logged focus sessions, and detected drift events. |

---

## 🎬 Demo Mode (for reviews)

Add this line to `.env` and restart the app:
```
DEMO_MODE=1
```
You get a **1-minute** focus option, **30-second / 1-minute** breaks, a **10-second** grace option on the
intention check, and focus blocks of 30+ seconds count on the dashboard. A "Demo mode" tag shows on the
timer so it's clear the timings are shortened. Remove the line (or set `DEMO_MODE=0`) for normal use.

## 🎥 Smart YouTube (video recognition)

`video_insight.py` reads the active tab's title and URL, works out the page kind (video, Short, or
home/search) and asks the AI (Groq, or keyword rules offline) what the video is and whether it relates to your
current intention. Toggle it in **Setup → Drift shield → Smart YouTube** (on by default).

- **On:** YouTube home/search is allowed for 90 seconds per focus block (30 in demo mode) so you can find a
  video. Videos related to your intention play normally. Shorts, off-topic videos and anything unclear are
  blocked, and the popup shows what was recognised.
- **Off:** YouTube is always blocked; the video is still labelled for the dashboard.

Study videos related to your intention never lower your focus accuracy. Other blocked apps (Instagram, Reddit...)
are not affected. The first time, macOS asks "Python wants to control Safari" (or Chrome): click **OK**.
