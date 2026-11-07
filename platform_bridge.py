"""Everything that differs between macOS and Windows lives here.

desktop_app.py and video_insight.py call these functions and never touch osascript or Win32 directly.

    get_active_window_info()  -> "App Name | Window Title" ("" when it can't be read)
    check_permissions()       -> True when DriftSync may read the foreground window
    bring_app_to_front(pid)   -> raise this process' windows above the distracting app
    hide_app(app_name)        -> minimise/hide the app the user drifted into
    read_browser_tab(app)     -> (title, url) of the active browser tab, ("", "") if unavailable
    notify(title, message)    -> system banner for Level 1 soft reminders (False if it couldn't be shown)
    chime()                   -> short system sound for Level 1 soft reminders (False if it couldn't play)
    idle_seconds()            -> seconds since the last key press or mouse move (None if unknown)
    request_camera_access()   -> asks the OS for the camera (OK / Cancel prompt); True when DriftSync may use it

The Windows code uses only ctypes and psutil (already in requirements.txt), so it needs no extra install.
App names come back in the same style as macOS ("google chrome", "microsoft edge") so the blocklist
matching in desktop_app.py works unchanged.
"""
import os
import subprocess
import sys

IS_WINDOWS = sys.platform == "win32"
IS_MAC = sys.platform == "darwin"


# ======================================================================
# macOS  (AppleScript)
# ======================================================================
def _osa(script, timeout=3, capture=True):
    return subprocess.run(["osascript", "-e", script], capture_output=capture, text=True, timeout=timeout)


def _mac_check_permissions():
    script = """
    tell application "System Events"
        try
            set frontProc to first application process whose frontmost is true
            set winCount to count of windows of frontProc
            return "OK"
        on error errMsg
            return "ERROR: " & errMsg
        end try
    end tell
    """
    try:
        res = _osa(script)
        if res.returncode != 0 or res.stdout.strip() != "OK":
            print(f"[PERMISSION] check failed: {(res.stdout or res.stderr).strip()[:200]}", flush=True)
            _mac_permission_modal()
            return False
        return True
    except Exception:
        _mac_permission_modal()
        return False


def _mac_permission_modal():
    """Short OK / Cancel. OK opens the Accessibility settings page."""
    app = _host_app_name().replace('"', '')
    modal_script = f'''
    tell application "System Events"
        activate
        set response to button returned of (display dialog "DriftSync needs Accessibility access to block distracting apps.\\n\\nClick OK, then turn on {app}." buttons {{"Cancel", "OK"}} default button "OK" with icon 2 with title "Accessibility Access")
        if response is "OK" then
            do shell script "open 'x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility'"
        end if
    end tell
    '''
    try:
        _osa(modal_script, timeout=120, capture=False)
    except Exception:
        pass


def _mac_active_window_info():
    script = """
    tell application "System Events"
        try
            set frontProc to first application process whose frontmost is true
            set appName to name of frontProc
            set winTitle to ""
            tell frontProc
                if (count of windows) > 0 then
                    set winTitle to name of window 1
                end if
            end tell
            return appName & " | " & winTitle
        on error errMsg
            return "ERR: " & errMsg
        end try
    end tell
    """
    try:
        res = _osa(script, timeout=5)
        out = res.stdout.strip()
        if res.returncode != 0 or not out or out.startswith("ERR:"):
            print(f"[RADAR DEBUG] empty scan | rc={res.returncode} | {(out or res.stderr.strip())[:200]}", flush=True)
            return ""
        return out
    except subprocess.TimeoutExpired:
        print("[RADAR DEBUG] osascript timed out (>5s)", flush=True)
        return ""
    except Exception as e:
        print(f"[RADAR DEBUG] scan failed: {e}", flush=True)
        return ""


def _mac_bring_to_front(pid):
    cmd = f'''
    tell application "System Events"
        set frontmost of every process whose unix id is {pid} to true
    end tell
    '''
    _osa(cmd)


def _mac_hide_app(app):
    app = (app or "").replace('"', '').replace('\\', '')
    if app:
        _osa(f'tell application "System Events" to set visible of (first process whose name is "{app}") to false')


_SAFARI_LIKE = {"safari", "safari technology preview", "orion"}
_CHROMIUM_LIKE = {"google chrome", "google chrome canary", "chromium", "brave browser",
                  "microsoft edge", "arc", "vivaldi", "opera", "dia", "comet"}


def _mac_read_browser_tab(app_name, timeout=4):
    app = (app_name or "").strip().replace('"', '')
    key = app.lower()
    if key in _SAFARI_LIKE:
        tab = "current tab of front window"
        script = f'tell application "{app}" to return (name of {tab}) & linefeed & (URL of {tab})'
    elif key in _CHROMIUM_LIKE:
        tab = "active tab of front window"
        script = f'tell application "{app}" to return (title of {tab}) & linefeed & (URL of {tab})'
    else:
        return "", ""      # Firefox and others have no AppleScript tab access: use the window title
    try:
        res = _osa(script, timeout=timeout)
        if res.returncode != 0:
            return "", ""
        title, _, url = res.stdout.rstrip("\n").partition("\n")
        return title.strip(), url.strip()
    except Exception:
        return "", ""


# ======================================================================
# Windows  (ctypes + psutil, no extra packages)
# ======================================================================
# process name -> the macOS-style name the blocklist matching expects
_WIN_APP_NAMES = {
    "chrome.exe": "google chrome",
    "msedge.exe": "microsoft edge",
    "firefox.exe": "firefox",
    "brave.exe": "brave browser",
    "opera.exe": "opera",
    "opera_gx.exe": "opera",
    "vivaldi.exe": "vivaldi",
    "arc.exe": "arc",
    "zen.exe": "zen browser",
    "duckduckgo.exe": "duckduckgo",
    "chromium.exe": "chromium",
    "comet.exe": "comet",
}


def _win_friendly_name(exe):
    exe = (exe or "").strip()
    low = exe.lower()
    if low in _WIN_APP_NAMES:
        return _WIN_APP_NAMES[low]
    return low[:-4] if low.endswith(".exe") else low


def _win_foreground():
    """(hwnd, pid, title) of the foreground window, or None."""
    import ctypes
    from ctypes import wintypes
    user32 = ctypes.windll.user32
    user32.GetForegroundWindow.restype = wintypes.HWND
    hwnd = user32.GetForegroundWindow()
    if not hwnd:
        return None
    length = user32.GetWindowTextLengthW(hwnd)
    buf = ctypes.create_unicode_buffer(length + 1)
    user32.GetWindowTextW(hwnd, buf, length + 1)
    pid = wintypes.DWORD()
    user32.GetWindowThreadProcessId(hwnd, ctypes.byref(pid))
    return hwnd, pid.value, buf.value


def _win_active_window_info():
    try:
        import psutil
        fg = _win_foreground()
        if not fg:
            return ""
        _hwnd, pid, title = fg
        name = _win_friendly_name(psutil.Process(pid).name())
        # Store apps (Calculator, Settings...) all report ApplicationFrameHost
        if name == "applicationframehost":
            name = title.lower() or name
        return f"{name} | {title}"
    except Exception as e:
        print(f"[RADAR DEBUG] scan failed: {e}", flush=True)
        return ""


def _win_windows_of(pid=None, exe_name=None):
    """All visible top-level window handles owned by a pid or by a process name."""
    import ctypes
    from ctypes import wintypes
    import psutil
    user32 = ctypes.windll.user32
    found = []
    EnumProc = ctypes.WINFUNCTYPE(wintypes.BOOL, wintypes.HWND, wintypes.LPARAM)

    def cb(hwnd, _lp):
        if not user32.IsWindowVisible(hwnd):
            return True
        p = wintypes.DWORD()
        user32.GetWindowThreadProcessId(hwnd, ctypes.byref(p))
        try:
            if pid is not None and p.value == pid:
                found.append(hwnd)
            elif exe_name is not None and _win_friendly_name(psutil.Process(p.value).name()) == exe_name:
                found.append(hwnd)
        except Exception:
            pass
        return True

    user32.EnumWindows(EnumProc(cb), 0)
    return found


def _win_bring_to_front(pid):
    import ctypes
    user32 = ctypes.windll.user32
    for hwnd in _win_windows_of(pid=pid):
        user32.ShowWindow(hwnd, 9)   # SW_RESTORE
        # Windows refuses SetForegroundWindow from a background process unless Alt is "pressed" first
        user32.keybd_event(0x12, 0, 0, 0)
        user32.SetForegroundWindow(hwnd)
        user32.keybd_event(0x12, 0, 2, 0)
        break


def _win_hide_app(app):
    import ctypes
    user32 = ctypes.windll.user32
    name = (app or "").strip().lower()
    if not name:
        return
    for hwnd in _win_windows_of(exe_name=name):
        user32.ShowWindow(hwnd, 6)   # SW_MINIMIZE


# ======================================================================
# Public API
# ======================================================================
def check_permissions():
    """Windows needs no permission to read the foreground window."""
    if IS_MAC:
        return _mac_check_permissions()
    return True


def get_active_window_info():
    if IS_MAC:
        return _mac_active_window_info()
    if IS_WINDOWS:
        return _win_active_window_info()
    return ""   # Linux is not supported


def bring_app_to_front(pid):
    try:
        if IS_MAC:
            _mac_bring_to_front(pid)
        elif IS_WINDOWS:
            _win_bring_to_front(pid)
    except Exception as e:
        print(f"Error raising window: {e}", flush=True)


def hide_app(app_name):
    try:
        if IS_MAC:
            _mac_hide_app(app_name)
        elif IS_WINDOWS:
            _win_hide_app(app_name)
    except Exception as e:
        print(f"Error hiding {app_name}: {e}", flush=True)


def _applescript_text(text):
    return '"' + str(text or "").replace("\\", "\\\\").replace('"', '\\"').replace("\n", " ") + '"'


def notify(title, message):
    """System banner. On Windows there is no banner without extra packages, so it returns False
    and the app shows its own reminder card instead."""
    try:
        if IS_MAC:
            _osa(f"display notification {_applescript_text(message[:180])} with title {_applescript_text(title)}")
            return True
    except Exception as e:
        print(f"Error showing banner: {e}", flush=True)
    return False


def chime():
    try:
        if IS_MAC:
            subprocess.Popen(["afplay", "/System/Library/Sounds/Glass.aiff"],
                             stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            return True
        if IS_WINDOWS:
            import winsound
            winsound.MessageBeep(winsound.MB_ICONASTERISK)
            return True
    except Exception as e:
        print(f"Error playing chime: {e}", flush=True)
    return False


# ======================================================================
# Camera permission (desk check)
# ======================================================================
# Run in a separate Python process so OpenCV asks macOS for the camera from its main thread:
# that is what makes macOS show its own "would like to access the camera" OK / Don't Allow prompt.
_CAMERA_PROBE = (
    "import sys, cv2\n"
    "backend = cv2.CAP_AVFOUNDATION if sys.platform == 'darwin' else (cv2.CAP_DSHOW if sys.platform == 'win32' else cv2.CAP_ANY)\n"
    "cap = cv2.VideoCapture(0, backend)\n"
    "ok = cap.isOpened() and cap.read()[0]\n"
    "cap.release()\n"
    "sys.exit(0 if ok else 3)\n"
)
_camera_granted = False


def _host_app_name():
    """The app macOS gives the camera permission to: the one DriftSync was started from."""
    term = os.environ.get("TERM_PROGRAM", "")
    return {"Apple_Terminal": "Terminal", "vscode": "Visual Studio Code", "iTerm.app": "iTerm"}.get(term, term or "Terminal")


def _camera_probe():
    env = dict(os.environ)
    env.pop("OPENCV_AVFOUNDATION_SKIP_AUTH", None)   # let OpenCV ask macOS for permission
    try:
        res = subprocess.run([sys.executable, "-c", _CAMERA_PROBE], env=env, timeout=120,
                             stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        return res.returncode == 0
    except Exception as e:
        print(f"[DESK CHECK] camera probe failed: {e}", flush=True)
        return False


def _mac_camera_denied_dialog():
    """Camera was refused earlier, so macOS won't ask again: our own OK / Cancel opens the right settings page."""
    app = _host_app_name().replace('"', '')
    script = f'''
    tell application "System Events"
        activate
        set response to button returned of (display dialog "DriftSync needs your camera for the desk check.\\n\\nClick OK, then turn on {app} in the Camera list." buttons {{"Cancel", "OK"}} default button "OK" with icon 2 with title "Camera Access")
        if response is "OK" then
            do shell script "open 'x-apple.systempreferences:com.apple.preference.security?Privacy_Camera'"
        end if
    end tell
    '''
    try:
        _osa(script, timeout=120, capture=False)
    except Exception:
        pass


def _win_camera_denied_dialog():
    try:
        import ctypes
        MB_OKCANCEL, MB_ICONINFORMATION, IDOK = 0x1, 0x40, 1
        answer = ctypes.windll.user32.MessageBoxW(
            None, "DriftSync needs your camera for the desk check.\n\nClick OK, then turn on "
                  "\"Let desktop apps access your camera\".", "Camera Access", MB_OKCANCEL | MB_ICONINFORMATION)
        if answer == IDOK:
            os.startfile("ms-settings:privacy-webcam")
    except Exception:
        pass


def request_camera_access():
    """True when the camera can be used. The first time on macOS this shows the system's own
    OK / Don't Allow prompt. If it was refused before, an OK / Cancel dialog opens the settings page."""
    global _camera_granted
    if _camera_granted:
        return True
    # macOS may need two tries: the first one shows the prompt, the second opens the camera
    if _camera_probe() or (IS_MAC and _camera_probe()):
        _camera_granted = True
        return True
    if IS_MAC:
        _mac_camera_denied_dialog()
    elif IS_WINDOWS:
        _win_camera_denied_dialog()
    return False


# ======================================================================
# Warnings: power, other camera apps, yes/no questions
# ======================================================================
def on_battery():
    """True on battery, False when plugged in, None if unknown (desktop PCs, errors)."""
    try:
        if IS_MAC:
            out = subprocess.run(["pmset", "-g", "batt"], capture_output=True, text=True, timeout=3).stdout
            if "Battery Power" in out:
                return True
            if "AC Power" in out:
                return False
            return None
        import psutil
        batt = psutil.sensors_battery()
        return None if batt is None else not batt.power_plugged
    except Exception:
        return None


# apps that often hold the camera: process name (lower case) -> what to call it
_CAMERA_APPS = {
    "zoom.us": "Zoom", "zoom": "Zoom", "zoom.exe": "Zoom",
    "facetime": "FaceTime", "photo booth": "Photo Booth",
    "microsoft teams": "Microsoft Teams", "msteams": "Microsoft Teams", "ms-teams.exe": "Microsoft Teams",
    "teams.exe": "Microsoft Teams", "msteams.exe": "Microsoft Teams",
    "webex": "Webex", "webexmta": "Webex", "ciscowebexstart.exe": "Webex",
    "obs": "OBS", "obs64.exe": "OBS", "skype": "Skype", "skype.exe": "Skype",
    "windowscamera.exe": "Camera",   # (Discord left out: it runs all day and rarely uses the camera)
}


def camera_apps_running():
    """Names of open apps that may be using the camera (Zoom, FaceTime, Teams...)."""
    try:
        import psutil
        found = []
        for p in psutil.process_iter(["name"]):
            name = _CAMERA_APPS.get((p.info.get("name") or "").lower())
            if name and name not in found:
                found.append(name)
        return found
    except Exception:
        return []


def confirm(title, message, ok="OK", cancel="Cancel"):
    """A native yes/no box, for when no page is open to show our own (e.g. quitting). True = OK."""
    try:
        if IS_MAC:
            script = (f"display dialog {_applescript_text(message)} with title {_applescript_text(title)} "
                      f"buttons {{{_applescript_text(cancel)}, {_applescript_text(ok)}}} "
                      f"default button {_applescript_text(cancel)} cancel button {_applescript_text(cancel)} with icon caution")
            res = _osa(script, timeout=300)
            return res.returncode == 0 and ok in res.stdout
        if IS_WINDOWS:
            import ctypes
            MB_OKCANCEL, MB_ICONWARNING, MB_DEFBUTTON2, IDOK = 0x1, 0x30, 0x100, 1
            return ctypes.windll.user32.MessageBoxW(None, message, title, MB_OKCANCEL | MB_ICONWARNING | MB_DEFBUTTON2) == IDOK
    except Exception:
        pass
    return True   # can't ask: don't trap the user in the app


def idle_seconds():
    """Seconds since the last keyboard or mouse input. The desk check uses it so typing with the
    camera blocked, or reading with your head down, still counts as being at the desk."""
    try:
        if IS_MAC:
            res = subprocess.run(["ioreg", "-c", "IOHIDSystem", "-d", "4", "-r", "-k", "HIDIdleTime"],
                                 capture_output=True, text=True, timeout=2)
            for line in res.stdout.splitlines():
                if '"HIDIdleTime"' in line:
                    return int(line.split("=")[-1].strip()) / 1_000_000_000   # nanoseconds
            return None
        if IS_WINDOWS:
            import ctypes
            from ctypes import wintypes

            class LASTINPUTINFO(ctypes.Structure):
                _fields_ = [("cbSize", wintypes.UINT), ("dwTime", wintypes.DWORD)]

            info = LASTINPUTINFO()
            info.cbSize = ctypes.sizeof(LASTINPUTINFO)
            if not ctypes.windll.user32.GetLastInputInfo(ctypes.byref(info)):
                return None
            now = ctypes.windll.kernel32.GetTickCount() & 0xFFFFFFFF
            return ((now - info.dwTime) & 0xFFFFFFFF) / 1000.0
    except Exception:
        return None
    return None


# ---------- Desk check alarm: rings nonstop and gets louder until you're back ----------
import atexit as _atexit
import threading as _threading

_alarm_stop = _threading.Event()
_alarm_thread = None
_alarm_player = None
_saved_volume = None   # (output volume, muted) before the alarm, restored when it stops
ALARM_START_VOLUME = 40   # macOS output volume when the alarm starts...
ALARM_VOLUME_STEP = 15    # ...raised by this much every ~2 seconds, up to 100


def _alarm_wav():
    """Alarm-clock "beep beep ... beep beep" (two short beeps, then a pause; 2 seconds), written once."""
    import math
    import struct
    import tempfile
    import wave
    path = os.path.join(tempfile.gettempdir(), "driftsync_alarm_beepbeep.wav")
    if os.path.exists(path):
        return path
    rate = 22050
    frames = bytearray()
    for i in range(rate * 2):
        t = i / rate
        c = t % 1.0                                      # one "beep beep" every second
        beep = c < 0.13 or 0.22 <= c < 0.35
        freq = 2000                                      # high piezo tone, like an alarm clock
        v = (1 if math.sin(2 * math.pi * freq * t) >= 0 else -1) * 0.9 if beep else 0.0   # square wave
        frames += struct.pack("<h", int(v * 32767))
    with wave.open(path, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(rate)
        w.writeframes(bytes(frames))
    return path


def _mac_get_volume():
    try:
        res = _osa("get {output volume of (get volume settings), output muted of (get volume settings)}")
        vol, muted = [x.strip() for x in res.stdout.split(",")]
        return int(vol), muted == "true"
    except Exception:
        return None


def _mac_set_volume(vol, muted=False):
    try:
        _osa(f"set volume output volume {int(vol)}" + (" with output muted" if muted else " without output muted"))
    except Exception:
        pass


def _alarm_loop(path):
    global _alarm_player
    volume = ALARM_START_VOLUME
    if IS_MAC and _saved_volume:
        volume = max(volume, _saved_volume[0])
    while not _alarm_stop.is_set():
        if IS_MAC:
            if _saved_volume is not None:                # only touch the volume if we can put it back later
                _mac_set_volume(volume)                  # unmute and get louder each round
            volume = min(100, volume + ALARM_VOLUME_STEP)
            _alarm_player = subprocess.Popen(["afplay", "-v", "1", path],
                                             stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            while _alarm_player.poll() is None and not _alarm_stop.is_set():
                _alarm_stop.wait(0.1)
            if _alarm_player.poll() is None:
                _alarm_player.kill()
        else:
            _alarm_stop.wait(0.5)


def start_alarm():
    """Starts the desk check alarm (does nothing if it's already ringing). True if it could start."""
    global _alarm_thread, _saved_volume
    if _alarm_thread and _alarm_thread.is_alive():
        return True
    try:
        path = _alarm_wav()
        _alarm_stop.clear()
        if IS_MAC:
            _saved_volume = _mac_get_volume()
        elif IS_WINDOWS:
            import winsound
            winsound.PlaySound(path, winsound.SND_FILENAME | winsound.SND_ASYNC | winsound.SND_LOOP)
        _alarm_thread = _threading.Thread(target=_alarm_loop, args=(path,), daemon=True)
        _alarm_thread.start()
        return True
    except Exception as e:
        print(f"Error starting alarm: {e}", flush=True)
        return chime()


def _stop_alarm_at_exit():
    try:
        stop_alarm()
    except Exception:
        pass


def stop_alarm():
    """Stops the alarm and puts the Mac's volume back the way it was."""
    global _alarm_thread, _saved_volume
    if not (_alarm_thread and _alarm_thread.is_alive()):
        return
    _alarm_stop.set()
    try:
        if _alarm_player and _alarm_player.poll() is None:
            _alarm_player.kill()
        if IS_WINDOWS:
            import winsound
            winsound.PlaySound(None, 0)
    except Exception:
        pass
    _alarm_thread.join(timeout=4)   # let a volume change in progress finish before we restore it
    _alarm_thread = None
    if IS_MAC and _saved_volume:
        _mac_set_volume(*_saved_volume)
    _saved_volume = None


def read_browser_tab(app_name, timeout=4):
    """(title, url). Windows cannot read a tab's URL without a browser extension, so it returns ("", "")
    and the caller falls back to the window title."""
    if IS_MAC:
        return _mac_read_browser_tab(app_name, timeout)
    return "", ""


# Ctrl+C or a crash must not leave the alarm ringing or the Mac's volume stuck at 100
_atexit.register(_stop_alarm_at_exit)
