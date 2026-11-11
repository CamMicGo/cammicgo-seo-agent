"""Emulator screenshots of every main tab (French UI), printed as base64 JPEG for review."""
import base64, io, re, subprocess, sys, time
from PIL import Image

PKG = "com.cammicgo.kamikoseo"
TABS = ["Assistant IA", "Extraire", "NotebookLM", "LinkedIn", "Aide"]

def adb(*a, binary=False):
    r = subprocess.run(["adb", *a], capture_output=True)
    return r.stdout if binary else r.stdout.decode(errors="replace")

def tap_text(label):
    adb("shell", "uiautomator", "dump", "/sdcard/ui.xml")
    xml = adb("shell", "cat", "/sdcard/ui.xml")
    for m in re.finditer(r'<node[^>]*?text="([^"]*)"[^>]*?bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"', xml):
        if m.group(1).strip() == label:
            x1, y1, x2, y2 = map(int, m.groups()[1:])
            adb("shell", "input", "tap", str((x1 + x2) // 2), str((y1 + y2) // 2))
            return True
    return False

def shot(name):
    png = adb("exec-out", "screencap", "-p", binary=True)
    im = Image.open(io.BytesIO(png)).convert("RGB")
    im = im.resize((im.width // 2, im.height // 2))
    buf = io.BytesIO(); im.save(buf, "JPEG", quality=72)
    print(f"SHOT-BEGIN {name}")
    data = base64.b64encode(buf.getvalue()).decode()
    for i in range(0, len(data), 3000): print("SHOT " + data[i:i + 3000])
    print(f"SHOT-END {name}")

adb("shell", "am", "start", "-n", f"{PKG}/.MainActivity")
time.sleep(6)
shot("00-launch")
for i, tab in enumerate(TABS):
    ok = tap_text(tab)
    time.sleep(4)
    shot(f"{i + 1:02d}-{tab.split()[0].lower()}{'' if ok else '-notfound'}")
    if tab not in ("NotebookLM", "LinkedIn"):
        adb("shell", "input", "swipe", "540", "1700", "540", "500", "400")
        time.sleep(2)
        shot(f"{i + 1:02d}-{tab.split()[0].lower()}-scrolled")
        adb("shell", "input", "swipe", "540", "600", "540", "1900", "300")
        time.sleep(1)
