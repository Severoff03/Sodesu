"""Regenerate Android launcher resources from www/assets/icon.png (Pillow required).

Run from any directory: python tools/generate_icons.py
The source must be opaque, square, full-bleed artwork without a baked-in mask.
Android 8+ applies the launcher's own mask to the adaptive background.
"""

from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
RES = ROOT / "android/app/src/main/res"
DENSITIES = {"mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}


def main():
    with Image.open(ROOT / "www/assets/icon.png") as source:
        rgba = source.convert("RGBA")
        if source.width != source.height or rgba.getextrema()[3] != (255, 255):
            raise ValueError("Launcher artwork must be square and fully opaque")
        artwork = rgba.convert("RGB")

    for density, size in DENSITIES.items():
        folder = RES / f"mipmap-{density}"
        folder.mkdir(parents=True, exist_ok=True)
        icon = artwork.resize((size, size), Image.Resampling.LANCZOS)
        for name in ("ic_launcher.png", "ic_launcher_round.png"):
            icon.save(folder / name)

    artwork.resize((512, 512), Image.Resampling.LANCZOS).save(
        RES / "mipmap-xxxhdpi/ic_launcher_store.png"
    )
    background = RES / "drawable-nodpi/ic_launcher_background.png"
    background.parent.mkdir(parents=True, exist_ok=True)
    artwork.resize((432, 432), Image.Resampling.LANCZOS).save(background)

    adaptive = RES / "mipmap-anydpi-v26"
    adaptive.mkdir(parents=True, exist_ok=True)
    xml = '''<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@drawable/ic_launcher_background" />
    <foreground android:drawable="@android:color/transparent" />
</adaptive-icon>
'''
    for name in ("ic_launcher.xml", "ic_launcher_round.xml"):
        (adaptive / name).write_text(xml, encoding="utf-8")


if __name__ == "__main__":
    main()
