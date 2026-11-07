# DriftSync — Context-Aware Digital Distraction Detection and Focus Recovery System

DriftSync combines a lightweight background monitor with a glassmorphism desktop GUI to enforce intentional computer use, detect task-drift in real time, and help students/professionals rapidly recover focus.

---

## 🚀 Quick Start (Running Natively)

### 1. Navigate to the project directory:
```bash
git clone https://github.com/Evoke8808/Driftsync-app.git
cd Driftsync-app
```

### 2. Install dependencies:
```bash
pip install -r requirements.txt
```
This installs PyWebView, psutil, certifi and OpenCV (for the webcam desk check).

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

> **macOS Note:** DriftSync asks for two permissions with a short OK / Cancel box: **Accessibility** (so the
> background monitor can read the front window and intercept distraction apps) and **Camera** (only if you turn on
> the desk check). Both are given to the app you start DriftSync from (Terminal, VS Code...).

---

## 📁 Project Architecture & Files

| File | Purpose |
| :--- | :--- |
| **`desktop_app.py`** | **Core Backend & Desktop Shell**: PyWebView API bridge, SQLite database manager, background window radar thread, and intent intercept window manager. |
| **`platform_bridge.py`** | **OS layer**: foreground-window detection, permissions, raise/hide app. macOS (AppleScript) and Windows (Win32 via ctypes). |
| **`timetable_ai.py`** | **Groq & Resilient Study Planner**: Generates multi-day cognitive study schedules with breaks, exam recap, and exam strategies. |
| **`login.html`** | **Account Portal**: User sign-in and registration with PBKDF2 + salt password hashing stored in SQLite, plus **Keep me signed in**. |
| **`setup.html`** | **Focus Session Launcher**: Configure active goals, enforcement persona (Corporate, College, School), duration, and custom blocklist items. |
| **`index.html`** | **Active Focus Timer**: Focus → break Pomodoro cycle, pause limits by strictness, and the built-in **AI Coach** (Groq `gpt-oss-20b`). |
| **`friction.html`** | **Intent Intercept Modal**: Pops up instantly when a blocked app/website is detected; forces the user to re-type their goal to unlock and start a grace period. |
| **`timetable.html`** | **Interactive Study Schedule**: Visual schedule timeline with direct **"Focus on this 🎯"** Action Bridge to prime the timer. |
| **`presence_check.py`** | **Desk check**: reads the webcam about once a second, finds your face on-device with OpenCV (YuNet model in `models/`) and, when you look down to write, checks your shoulders are still in the seat. |
| **`alarm.html`** | **Come-back alarm screen**: full-screen see-through red layer with an away counter while the desk check alarm rings. |
| **`dialog.js`** | **Warning popups**: the shared OK / Cancel card used for warnings in Setup and on the timer. |
| **`models/face_detection_yunet.onnx`** | **Face detector model** (YuNet, MIT licence, from libfacedetection). |
| **`video_insight.py`** | **YouTube Video Recognition**: reads the video title and labels it with AI (or keyword rules offline). |
| **`coach_patterns.py`** | **AI Coach Pattern Library**: 29 study blockers the coach recognises, also used offline. |
| **`theme.css`** | **Calm Focus Theme**: shared colours, buttons and cards for every page. |
| **`dashboard.html`** | **Analytics Dashboard**: Weekly focus charts, session accuracy ring, distraction breakdowns, and historical logs. |
| **`focusguard.db`** | **SQLite Database**: Stores user accounts, logged focus sessions, and detected drift events (git-ignored, created on first run). |
| **`prefs.json`** | **Local settings**: saved sign-in key and which one-time warnings you've seen (git-ignored, created on first run). |

---

## 🎬 Demo Mode (for reviews)

Add this line to `.env` and restart the app:
```
DEMO_MODE=1
```
You get a **1-minute** focus option, **30-second / 1-minute** breaks, a **10-second** grace option on the
intention check, and focus blocks of 30+ seconds count on the dashboard. A "Demo mode" tag shows on the
timer so it's clear the timings are shortened. Remove the line (or set `DEMO_MODE=0`) for normal use.

## 🪑 Desk check (webcam)

Makes sure you stay at your desk during a focus block. Turn it on in **Setup → Drift shield → Desk check**
(off by default) and press **Test camera** to see the live preview with a green box around your face.

- About once a second, `presence_check.py` reads one webcam frame, shrinks it to 320 px and looks for a face with
  OpenCV's YuNet detector (`models/face_detection_yunet.onnx`). Everything runs on this computer: frames stay in
  memory and are never saved or sent anywhere. The camera is only on during focus blocks (and the Setup test).
- Looking down to write hides your face, so DriftSync also remembers your shoulders (a colour fingerprint, never a
  picture). If your face is gone but your shoulders are still in the seat and something moved there in the last
  15 seconds (writing, breathing), you still count as at your desk. An empty chair doesn't match or doesn't move.
- A key press or mouse move in the last 15 seconds also counts as "at your desk", so reading notes with your head
  down while typing doesn't trigger it.
- A red **away timer** appears next to the timer box as soon as you leave the camera's view.
- Out of view for 10 seconds (any level): the timer pauses, the whole screen turns see-through red with
  "Come back to your desk", and a "beep beep ... beep beep" alarm rings nonstop, turning the Mac's volume up step
  by step (your volume is put back afterwards). When the camera sees your face again the alarm stops and the timer
  resumes by itself. One **Away from desk** drift is logged each time. Typing or mouse moves don't stop it: only
  your face does, so the timer can't be left running while you're away.
- Ways out: **"End this focus block"** on the red screen (logged as Stopped Early) if the camera can't see you;
  the alarm also stops by itself if the camera disconnects, or after 5 minutes with nobody back (the timer stays
  paused).
- The live camera preview sits in the bottom-right corner of the timer page (click **Hide** to save battery).
- Turning on Desk check shows the macOS camera prompt by itself: click **OK**.
  On Windows, check Settings > Privacy & security > Camera > "Let desktop apps access your camera".
- No camera or no permission: the badge on the timer says "Camera off" and nothing is ever paused because of it.

## ⚠️ Warnings

Short OK / Cancel popups so nothing catches you off guard:

| When | Warning |
| :--- | :--- |
| Turning on Desk check (first time) | Camera privacy (nothing recorded or sent) and the loud alarm / volume to 100% |
| Turning on Desk check on battery | The camera can drain your battery, plug in |
| Starting a block with Desk check on | Zoom, FaceTime, Teams, Webex, OBS or Skype is open and may be using the camera |
| Camera test / during a block | Too dark for the camera to see you |
| Starting a Level 3 (School) block | No pauses and no early stop |
| Starting with an empty drift list | Nothing will be blocked |
| Choosing a 60-minute block | Are you sure? |
| Quitting during a focus block | It ends the block as Stopped Early |
| Accessibility permission missing | Short OK / Cancel that opens the right settings page |

## 🔑 Keep me signed in

Tick **Keep me signed in on this computer** (on by default) when you sign in, and DriftSync opens straight to
Setup next time. A random key is saved in `prefs.json` and only its hash is stored in the database; your password
is never saved. **Sign out** turns it off.

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
