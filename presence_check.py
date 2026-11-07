"""Desk check: is someone sitting in front of the computer?

The webcam is read about once a second and a small face detector runs on the frame, all on this
computer. Frames live in memory only: nothing is saved to disk or sent anywhere. The camera is
opened only while someone asks for it (want()), and released a few seconds after they stop.

    watcher = PresenceWatcher()
    watcher.want(seconds=3)          # keep the camera on for 3 more seconds (call it every second)
    watcher.last_face_at             # time.time() when a face was last seen (0 = never)
    watcher.want(3, preview=True)    # Setup's camera test: also keep a small JPEG with the face box
    watcher.preview_data_url()       # "data:image/jpeg;base64,..." or None

Detector: YuNet (models/face_detection_yunet.onnx, MIT licence, from libfacedetection) through
OpenCV's FaceDetectorYN. If that can't load, OpenCV 4's built-in Haar face cascades are used.
"""
import base64
import os
import sys
import threading
import time
from pathlib import Path

# macOS: OpenCV otherwise tries to show the camera permission prompt from this background thread,
# which fails. With this set, macOS shows its own prompt the first time the camera is opened.
os.environ.setdefault("OPENCV_AVFOUNDATION_SKIP_AUTH", "1")

try:
    import cv2
except ImportError:      # pip install opencv-python
    cv2 = None

MODEL_PATH = Path(__file__).parent / "models" / "face_detection_yunet.onnx"
FRAME_WIDTH = 320              # frames are shrunk to this width before detection (fast, and enough at a desk)
CHECK_INTERVAL_SEC = 1.0       # one frame a second during a focus block
PREVIEW_INTERVAL_SEC = 0.03    # while a preview is open: read frames back to back (~20+ fps)
REOPEN_WAIT_SEC = 5            # wait before trying the camera again after it failed to open
MIN_FACE_FRAC = 0.08           # a face narrower than 8% of the frame is too far away to be "at the desk"
CONFIRM_SCORE = 0.8            # YuNet confidence needed for a face to count (lower ones are only drawn)
# Body check: looking down to write hides your face, so we also remember your shoulders.
BODY_MATCH = 0.5               # colour match (0-1) between the shoulder area now and when your face was last seen
BODY_MOTION_SEC = 15           # ...and something in that area moved within this many seconds (an empty chair is still)
MOTION_PIXEL_DIFF = 20         # a pixel "moved" if its brightness changed this much between checks
MOTION_MIN_FRACTION = 0.004    # at least this share of the area must move to count as movement
CONFIRM_SEC = 0.8              # a face must stay in view this long (every frame) before it counts


def camera_error_hint():
    if sys.platform == "darwin":
        return ("Camera not available. Allow it in System Settings > Privacy & Security > Camera "
                "for the app you start DriftSync from (Terminal, VS Code...), then try again.")
    if sys.platform == "win32":
        return ("Camera not available. Check Settings > Privacy & security > Camera "
                "(\"Let desktop apps access your camera\") and that no other app is using it.")
    return "Camera not available."


class FaceFinder:
    """Finds faces in a small BGR frame. kind is 'yunet', 'haar' or None (no detector)."""

    def __init__(self):
        self.kind = None
        self._yunet = None
        self._frontal = None
        self._profile = None
        if cv2 is None:
            return
        if MODEL_PATH.exists() and hasattr(cv2, "FaceDetectorYN"):
            try:
                # score 0.6: a bit lower than the default so a face tilted down at notes still counts
                self._yunet = cv2.FaceDetectorYN.create(str(MODEL_PATH), "", (FRAME_WIDTH, 240), 0.6, 0.3, 20)
                self.kind = "yunet"
                return
            except Exception as e:
                print(f"[DESK CHECK] YuNet model failed to load, using Haar instead: {e}", flush=True)
        try:
            folder = Path(cv2.data.haarcascades)
            frontal = cv2.CascadeClassifier(str(folder / "haarcascade_frontalface_default.xml"))
            profile = cv2.CascadeClassifier(str(folder / "haarcascade_profileface.xml"))
            if not frontal.empty():
                self._frontal = frontal
                self._profile = profile if not profile.empty() else None
                self.kind = "haar"
        except Exception:
            pass   # OpenCV 5 has no Haar cascades

    def find(self, frame):
        """List of (x, y, w, h) boxes of faces that count: confident and big enough to be at the desk."""
        if self.kind == "yunet":
            h, w = frame.shape[:2]
            self._yunet.setInputSize((w, h))
            _, faces = self._yunet.detect(frame)
            if faces is None:
                return []
            return [tuple(int(v) for v in f[:4]) for f in faces
                    if f[14] >= CONFIRM_SCORE and f[2] >= MIN_FACE_FRAC * w]
        if self.kind == "haar":
            gray = cv2.equalizeHist(cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY))
            found = list(self._frontal.detectMultiScale(gray, 1.1, 5, minSize=(36, 36)))
            if not found and self._profile is not None:
                found = list(self._profile.detectMultiScale(gray, 1.1, 5, minSize=(36, 36)))
                if not found:   # the profile cascade only knows one side, so also try the mirror image
                    w = gray.shape[1]
                    found = [(w - x - fw, y, fw, fh) for x, y, fw, fh in
                             self._profile.detectMultiScale(cv2.flip(gray, 1), 1.1, 5, minSize=(36, 36))]
            return [tuple(int(v) for v in b) for b in found if b[2] >= MIN_FACE_FRAC * frame.shape[1]]
        return []


def shrink(frame, width=FRAME_WIDTH):
    h, w = frame.shape[:2]
    if w <= width:
        return frame
    return cv2.resize(frame, (width, int(h * width / w)), interpolation=cv2.INTER_AREA)


class PresenceWatcher:
    def __init__(self, camera_index=0):
        self.camera_index = camera_index
        self.finder = None
        self.last_face_at = 0.0
        self.last_frame_at = 0.0
        self.faces_now = 0
        self.brightness = None         # average brightness 0-255 of the last frame (for "too dark")
        self.last_body_at = 0.0        # last time your shoulders were still in the seat (face may be hidden)
        self.last_motion_at = 0.0
        self.body_match = None         # last colour match of the shoulder area (for the log / preview)
        self._body_ref = None          # colour fingerprint (numbers only, no picture) of your shoulder area
        self._body_box = None          # where your shoulders are in the frame
        self._prev_gray = None
        self._face_since = 0.0         # start of the current run of frames that all had a face
        self.error = None if cv2 is not None else "OpenCV is not installed. Run: pip install opencv-python"
        self._wanted_until = 0.0
        self._preview_until = 0.0
        self._preview_jpeg = None
        self._cap = None
        self._thread = None
        self._stop = False
        self._lock = threading.Lock()

    @property
    def camera_on(self):
        return self._cap is not None

    @property
    def detector(self):
        return self.finder.kind if self.finder else None

    def want(self, seconds=3.0, preview=False):
        """Keep the camera on for `seconds` more. Returns False when OpenCV is missing."""
        if cv2 is None:
            return False
        now = time.time()
        with self._lock:
            self._wanted_until = max(self._wanted_until, now + seconds)
            if preview:
                self._preview_until = max(self._preview_until, now + seconds)
            if self._thread is None or not self._thread.is_alive():
                self._stop = False
                self._thread = threading.Thread(target=self._run, name="desk-check", daemon=True)
                self._thread.start()
        return True

    def stop(self):
        """Release the camera now (app closing)."""
        self._stop = True
        self._wanted_until = 0.0
        self._preview_until = 0.0

    def preview_data_url(self):
        jpeg = self._preview_jpeg
        if not jpeg or time.time() > self._preview_until:
            return None
        return "data:image/jpeg;base64," + base64.b64encode(jpeg).decode()

    # ---------- camera thread ----------
    def _open(self):
        if sys.platform == "darwin":
            cap = cv2.VideoCapture(self.camera_index, cv2.CAP_AVFOUNDATION)
        elif sys.platform == "win32":
            cap = cv2.VideoCapture(self.camera_index, cv2.CAP_DSHOW)   # opens much faster than the default
        else:
            cap = cv2.VideoCapture(self.camera_index)
        if not cap.isOpened():
            cap.release()
            return None
        try:
            cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
            cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
            cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
        except Exception:
            pass
        return cap

    def _release(self):
        if self._cap is not None:
            try:
                self._cap.release()
            except Exception:
                pass
            self._cap = None
            self._preview_jpeg = None
            self.faces_now = 0
            # forget the shoulder fingerprint: next block you may wear something else, so learn it fresh from your face
            self._body_ref = self._body_box = self._prev_gray = None
            print("[DESK CHECK] Camera off.", flush=True)

    def _run(self):
        failed_reads = 0
        next_open_at = 0.0
        while not self._stop:
            now = time.time()
            if now > self._wanted_until:
                self._release()
                if now > self._wanted_until + 30:
                    break          # idle for a while: let the thread end, want() starts a new one
                time.sleep(0.5)
                continue

            if self._cap is None:
                if now < next_open_at:
                    time.sleep(0.5)
                    continue
                if self.finder is None:
                    self.finder = FaceFinder()
                    if not self.finder.kind:
                        self.error = "No face detector available. Install OpenCV 4: pip install \"opencv-python<5\""
                self._cap = self._open()
                if self._cap is None:
                    self.error = camera_error_hint()
                    next_open_at = now + REOPEN_WAIT_SEC
                    continue
                print(f"[DESK CHECK] Camera on (detector: {self.detector}). Frames stay in memory only.", flush=True)
                failed_reads = 0
                if self.finder.kind:
                    self.error = None

            previewing = time.time() < self._preview_until
            if not previewing:
                self._cap.grab()   # 1 frame a second: drop the buffered one so we look at "now"
            ok, frame = self._cap.read()
            if not ok or frame is None:
                failed_reads += 1
                if failed_reads >= 3:
                    self.error = camera_error_hint()
                    self._release()
                    next_open_at = time.time() + REOPEN_WAIT_SEC
                time.sleep(0.3)
                continue
            failed_reads = 0
            self.last_frame_at = time.time()

            small = shrink(frame)
            try:
                self.brightness = float(cv2.cvtColor(small, cv2.COLOR_BGR2GRAY).mean())
            except Exception:
                self.brightness = None
            try:
                faces = self.finder.find(small) if self.finder else []
            except Exception as e:
                print(f"[DESK CHECK] detector error: {e}", flush=True)
                faces = []
            self.faces_now = len(faces)
            if not faces:
                self._face_since = 0.0
            elif not self._face_since:
                self._face_since = self.last_frame_at
            # one odd frame (a shadow, a poster) doesn't count: the face has to stay for a moment
            # (at 1 frame a second that means two frames in a row)
            if self._face_since and (self.last_frame_at - self._face_since >= CONFIRM_SEC
                                     or (not previewing and self.last_frame_at > self._face_since)):
                self.last_face_at = self.last_frame_at
            try:
                self._check_body(small, faces)
            except Exception as e:
                print(f"[DESK CHECK] body check error: {e}", flush=True)

            if previewing:
                self._preview_jpeg = self._draw_preview(small, faces, self._body_box,
                                                        not faces and self.last_body_at == self.last_frame_at)
            else:
                self._preview_jpeg = None
            del frame, small      # nothing from the camera is kept between checks (except the live preview)
            time.sleep(PREVIEW_INTERVAL_SEC if previewing else CHECK_INTERVAL_SEC)
        self._release()

    # ---------- body check (head down) ----------
    @staticmethod
    def _shoulder_box(face, shape):
        """The area just below a face: shoulders and upper chest."""
        x, y, fw, fh = face
        h, w = shape[:2]
        x0, x1 = max(0, int(x - 0.8 * fw)), min(w, int(x + fw + 0.8 * fw))
        y0, y1 = min(h - 1, int(y + 1.1 * fh)), min(h, int(y + 2.4 * fh))
        if x1 - x0 < 10 or y1 - y0 < 10:
            return None
        return x0, y0, x1, y1

    @staticmethod
    def _fingerprint(small, box):
        x0, y0, x1, y1 = box
        hsv = cv2.cvtColor(small[y0:y1, x0:x1], cv2.COLOR_BGR2HSV)
        hist = cv2.calcHist([hsv], [0, 1], None, [30, 32], [0, 180, 0, 256])   # colour only, not brightness
        cv2.normalize(hist, hist)
        return hist

    def _check_body(self, small, faces):
        now = self.last_frame_at
        gray = cv2.GaussianBlur(cv2.cvtColor(small, cv2.COLOR_BGR2GRAY), (5, 5), 0)
        prev, self._prev_gray = self._prev_gray, gray

        if faces and self.last_face_at == now:
            # face confirmed: (re)learn what your shoulders look like, slowly, so lighting changes are followed
            face = max(faces, key=lambda f: f[2] * f[3])
            box = self._shoulder_box(face, small.shape)
            if box:
                hist = self._fingerprint(small, box)
                self._body_ref = hist if self._body_ref is None or self._body_ref.shape != hist.shape \
                    else cv2.addWeighted(self._body_ref, 0.8, hist, 0.2, 0)
                self._body_box = box
            self.last_body_at = now
            return
        if faces or self._body_ref is None or self._body_box is None:
            return

        # No face: is someone still sitting there (head down)? Same colours where your shoulders were,
        # and some movement around them (writing, breathing). An empty chair fails one or both.
        x0, y0, x1, y1 = self._body_box
        if prev is not None and prev.shape == gray.shape:
            fw = x1 - x0
            ax0, ax1 = max(0, x0 - fw // 2), min(gray.shape[1], x1 + fw // 2)   # include arms and the head above
            ay0 = max(0, y0 - (y1 - y0))
            diff = cv2.absdiff(gray[ay0:, ax0:ax1], prev[ay0:, ax0:ax1])
            if (diff > MOTION_PIXEL_DIFF).mean() >= MOTION_MIN_FRACTION:
                self.last_motion_at = now
        self.body_match = float(cv2.compareHist(self._body_ref, self._fingerprint(small, self._body_box),
                                                cv2.HISTCMP_CORREL))
        if self.body_match >= BODY_MATCH and now - self.last_motion_at <= BODY_MOTION_SEC:
            self.last_body_at = now

    @staticmethod
    def _draw_preview(small, faces, body_box=None, body_only=False):
        img = cv2.flip(small, 1)          # mirror it, like every camera app
        w = img.shape[1]
        for x, y, fw, fh in faces:
            cv2.rectangle(img, (w - x - fw, y), (w - x, y + fh), (120, 200, 90), 2)
        if body_only and body_box:        # head down: show the shoulder area that is keeping you "at desk"
            x0, y0, x1, y1 = body_box
            cv2.rectangle(img, (w - x1, y0), (w - x0, y1), (60, 170, 255), 2)
        ok, buf = cv2.imencode(".jpg", img, [int(cv2.IMWRITE_JPEG_QUALITY), 70])
        return buf.tobytes() if ok else None
