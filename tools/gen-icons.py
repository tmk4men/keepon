#!/usr/bin/env python3
"""アプリのアイコンを public/icon.png からまとめて作る。

作るもの:
  1. iOS の AppIcon 一式（ホーム画面・設定・Spotlight・通知・App Store 用）
  2. iOS のスプラッシュ
  3. Web / PWA 用（192・512・maskable・apple-touch-icon 180）

元画像は角丸と白余白が入っているため、iOS のように OS 側で角丸を付ける場面では
二重角丸になる。ここでは紋章（緑の部分）だけを切り出し、背景色を敷いた正方形に
置き直したうえで各サイズに書き出す。

使い方: python tools/gen-icons.py
"""

import json
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "public" / "icon.png"
PUBLIC = ROOT / "public"
ICON_DIR = ROOT / "ios" / "App" / "App" / "Assets.xcassets" / "AppIcon.appiconset"
SPLASH_DIR = ROOT / "ios" / "App" / "App" / "Assets.xcassets" / "Splash.imageset"

ICON_BG = (255, 248, 236)  # 元アイコン内側のクリーム
SPLASH_BG = (244, 241, 234)  # アプリ本体の --bg と同じ
ICON_GLYPH_RATIO = 0.72
MASKABLE_GLYPH_RATIO = 0.56  # 円形に切られても欠けないよう内側に収める
SPLASH_SIZE = 2732
SPLASH_GLYPH_PX = 640

# iOS の AppIcon。(pt, scale, idiom) で、実ピクセルは pt * scale
IOS_ICONS = [
    (20, 2, "iphone"), (20, 3, "iphone"),
    (29, 2, "iphone"), (29, 3, "iphone"),
    (40, 2, "iphone"), (40, 3, "iphone"),
    (60, 2, "iphone"), (60, 3, "iphone"),
    (20, 1, "ipad"), (20, 2, "ipad"),
    (29, 1, "ipad"), (29, 2, "ipad"),
    (40, 1, "ipad"), (40, 2, "ipad"),
    (76, 2, "ipad"),
    (83.5, 2, "ipad"),
    (1024, 1, "ios-marketing"),
]

_cached_glyph = None


def glyph() -> Image.Image:
    """元画像から緑の紋章だけを切り出す（背景は透明にする）。"""
    global _cached_glyph
    if _cached_glyph is not None:
        return _cached_glyph

    im = Image.open(SRC).convert("RGBA")
    a = np.array(im).astype(int)
    green = (a[:, :, 1] > a[:, :, 0] + 25) & (a[:, :, 1] > 80)

    # 行/列ごとに 4px 以上緑があるところを紋章の範囲とする（にじみ・影を除く）
    rows = [i for i, v in enumerate(green.sum(axis=1)) if v > 3]
    cols = [i for i, v in enumerate(green.sum(axis=0)) if v > 3]
    cropped = im.crop((cols[0], rows[0], cols[-1] + 1, rows[-1] + 1))

    # クリーム地を透明にする（紋章の緑だけ残す）。縁は緑らしさの度合いでぼかす。
    arr = np.array(cropped).astype(int)
    hard = np.where(
        (arr[:, :, 1] > arr[:, :, 0] + 12) & (arr[:, :, 1] > 60), 255, 0
    ).astype(np.uint8)
    soft = np.clip((arr[:, :, 1] - arr[:, :, 0] - 4) * 12, 0, 255).astype(np.uint8)
    alpha = np.maximum(hard, soft)
    _cached_glyph = Image.fromarray(np.dstack([arr[:, :, :3].astype(np.uint8), alpha]))
    return _cached_glyph


def compose(size: int, bg: tuple, glyph_px: int) -> Image.Image:
    g = glyph()
    ratio = glyph_px / max(g.size)
    g = g.resize(
        (max(1, round(g.width * ratio)), max(1, round(g.height * ratio))), Image.LANCZOS
    )
    canvas = Image.new("RGB", (size, size), bg)
    canvas.paste(g, ((size - g.width) // 2, (size - g.height) // 2), g)
    return canvas


def write_ios_icons() -> None:
    # 古い書き出しを消してから作り直す（残っていると Xcode が未割り当て警告を出す）
    for old in ICON_DIR.glob("*.png"):
        old.unlink()

    images = []
    for pt, scale, idiom in IOS_ICONS:
        px = round(pt * scale)
        name = f"AppIcon-{pt:g}@{scale}x-{idiom}.png"
        # App Store 用アイコンはアルファ不可。ほかも不要なので全て RGB で保存する。
        compose(px, ICON_BG, round(px * ICON_GLYPH_RATIO)).save(ICON_DIR / name, "PNG")
        images.append(
            {
                "filename": name,
                "idiom": idiom,
                "scale": f"{scale}x",
                "size": f"{pt:g}x{pt:g}",
            }
        )
        print("wrote", name, f"{px}x{px}")

    (ICON_DIR / "Contents.json").write_text(
        json.dumps(
            {"images": images, "info": {"author": "xcode", "version": 1}}, indent=2
        )
        + "\n",
        encoding="utf-8",
    )


def write_ios_splash() -> None:
    splash = compose(SPLASH_SIZE, SPLASH_BG, SPLASH_GLYPH_PX)
    for name in (
        "splash-2732x2732.png",
        "splash-2732x2732-1.png",
        "splash-2732x2732-2.png",
    ):
        splash.save(SPLASH_DIR / name, "PNG")
    print("wrote splash x3", f"{SPLASH_SIZE}x{SPLASH_SIZE}")


def write_web_icons() -> None:
    # PWA のインストール要件（192 と 512）と、iOS のホーム画面追加（180）
    for size in (180, 192, 512):
        out = PUBLIC / f"icon-{size}.png"
        compose(size, ICON_BG, round(size * ICON_GLYPH_RATIO)).save(out, "PNG")
        print("wrote", out.name, f"{size}x{size}")

    # maskable は円形に切られる前提で、内側に小さく置く
    out = PUBLIC / "icon-maskable-512.png"
    compose(512, ICON_BG, round(512 * MASKABLE_GLYPH_RATIO)).save(out, "PNG")
    print("wrote", out.name, "512x512")


def main() -> None:
    write_ios_icons()
    write_ios_splash()
    write_web_icons()


if __name__ == "__main__":
    main()
