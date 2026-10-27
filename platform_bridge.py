"""Everything that differs between macOS and Windows lives here.

desktop_app.py and video_insight.py call these functions and never touch osascript or Win32 directly.

    get_active_window_info()  -> "App Name | Window Title" ("" when it can't be read)
    check_permissions()       -> True when DriftSync may read the foreground window
    bring_app_to_front(pid)   -> raise this process' windows above the distracting app
    hide_app(app_name)        -> minimise/hide the app the user drifted into
    read_browser_tab(app)     -> (title, url) of the active browser tab, ("", "") if unavailable

The Windows code uses only ctypes and psutil (already in requirements.txt), so it needs no extra install.
App names come back in the same style as macOS ("google chrome", "microsoft edge") so the blocklist
matching in desktop_app.py works unchanged.
"""
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
    modal_script = '''
    tell application "System Events"
        activate
        set response to button returned of (display dialog "DriftSync needs macOS Accessibility permissions to monitor browser tabs and block distractions during focus sessions.\\n\\nPlease toggle ON the app you launched DriftSync from (Terminal, VS Code, Cursor...) in System Settings > Privacy & Security > Accessibility." buttons {"Open Settings", "Cancel"} default button "Open Settings" with icon 2 with title "Permission Required")
        if response is "Open Settings" then
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


def read_browser_tab(app_name, timeout=4):
    """(title, url). Windows cannot read a tab's URL without a browser extension, so it returns ("", "")
    and the caller falls back to the window title."""
    if IS_MAC:
        return _mac_read_browser_tab(app_name, timeout)
    return "", ""
