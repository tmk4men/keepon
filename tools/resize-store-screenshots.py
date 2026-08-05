#!/usr/bin/env python3
"""ストア用スクリーンショットを App Store のサイズに合わせる。

元素材は 941x1672（9:16）で、6.5インチ（1242x2688）はもっと縦長。
そのまま引き伸ばすと潰れるので、横幅を合わせてから足りない縦を背景で埋める。

  ・上は一様なクリーム地なので、いちばん上の行をそのまま伸ばす（継ぎ目が出ない）
  ・下は端末が画面外へ抜けるデザインなので、いちばん下の行を伸ばす（端末が続いて見える）

使い方: python tools/resize-store-screenshots.py
出力: appstore-6.5/ と appstore-6.9/
"""

from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent

# (フォルダ名, 幅, 高さ)
TARGETS = [
    ("appstore-6.5", 1242, 2688),  # iPhone 6.5インチ
    ("appstore-6.9", 1290, 2796),  # iPhone 6.9インチ（現在の主サイズ）
]

# 足りない縦をどう分けるか（上:下）。下を厚めにして端末を伸ばす。
TOP_SHARE = 0.3

# ストアに並べる順。1枚目がいちばん見られるので、コンセプト → 毎日の使い方 →
# 記録 → 継続力 → 初期設定 → 手軽さ の順にする。
# 素材のファイル名は先頭8文字で指定（元のUUID名のまま扱う）。
ORDER = [
    "EBB57BFF",  # 止まっても、また戻れる。
    "93D9F1F2",  # 今日やることが、すぐわかる。
    "171D9D80",  # 小さな積み重ねを、きろくできる。
    "402ABEE5",  # 続ける力まで、見える化。
    "5813ABCA",  # 目標に合わせて、迷わず始める。
    "307B8E58",  # 入力はかんたん。メニューは自動。
]


def fit(src: Image.Image, width: int, height: int) -> Image.Image:
    # 横幅を合わせる（比率は保つ）
    scaled_h = round(src.height * width / src.width)
    scaled = src.resize((width, scaled_h), Image.LANCZOS)

    if scaled_h == height:
        return scaled
    if scaled_h > height:
        # 目標より縦が長いときだけ、上下を均等に切る
        top = (scaled_h - height) // 2
        return scaled.crop((0, top, width, top + height))

    gap = height - scaled_h
    top_pad = round(gap * TOP_SHARE)
    bottom_pad = gap - top_pad

    a = np.array(scaled)
    top_band = np.repeat(a[:1], top_pad, axis=0) if top_pad else np.empty((0, width, 3), a.dtype)
    bottom_band = (
        np.repeat(a[-1:], bottom_pad, axis=0) if bottom_pad else np.empty((0, width, 3), a.dtype)
    )
    return Image.fromarray(np.vstack([top_band, a, bottom_band]))


def main() -> None:
    found = {p.name[:8]: p for p in ROOT.glob("*.png") if Image.open(p).size == (941, 1672)}
    if not found:
        print("941x1672 の素材が見つかりません")
        return

    # ORDER に載っているものを先に、載っていないものは名前順で後ろに付ける
    sources = [found.pop(k) for k in ORDER if k in found]
    sources += [found[k] for k in sorted(found)]

    for folder, w, h in TARGETS:
        out_dir = ROOT / folder
        out_dir.mkdir(exist_ok=True)
        for old in out_dir.glob("*.png"):
            old.unlink()
        for i, src_path in enumerate(sources, start=1):
            src = Image.open(src_path).convert("RGB")
            out = fit(src, w, h)
            out_path = out_dir / f"screenshot-{i}.png"
            out.save(out_path, "PNG")
            print(f"{folder}/{out_path.name}  ←  {src_path.name[:8]}…  {out.size}")
        print()


if __name__ == "__main__":
    main()
