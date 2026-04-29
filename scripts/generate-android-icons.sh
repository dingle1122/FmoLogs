#!/usr/bin/env bash
# 从 public/vite.png 生成 Android 各密度启动图标（含 legacy / round / adaptive foreground）。
# 布局：白底 + 内容居中留安全边距。
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC_PNG="$ROOT/public/vite.png"
ANDROID_SRC="$ROOT/src-tauri/icon-android.png"
RES_DIR="$ROOT/android/app/src/main/res"

if ! command -v magick >/dev/null 2>&1; then
  echo "需要 ImageMagick (magick)，请先安装：brew install imagemagick" >&2
  exit 1
fi

if [ ! -f "$SRC_PNG" ]; then
  echo "找不到源图：$SRC_PNG" >&2
  exit 1
fi

mkdir -p "$(dirname "$ANDROID_SRC")"

# 1) 1024x1024 白底母图（内容缩到约 50% 居中）
magick "$SRC_PNG" \
  -resize 512x512 \
  -background white -gravity center -extent 1024x1024 \
  -alpha remove -alpha off \
  "$ANDROID_SRC"

# 2) 1024x1024 透明底 foreground 母图（内容缩到约 50% 居中，符合 Android adaptive icon 安全区）
TMP_DIR="$ROOT/.icon-tmp"
mkdir -p "$TMP_DIR"
TMP_FG="$TMP_DIR/fmo-fg.png"
trap 'rm -rf "$TMP_DIR"' EXIT
magick "$SRC_PNG" \
  -resize 512x512 \
  -background none -gravity center -extent 1024x1024 \
  "$TMP_FG"

# 3) 按密度生成
DENSITIES=(mdpi hdpi xhdpi xxhdpi xxxhdpi)
LEGACY_SIZES=(48 72 96 144 192)
FG_SIZES=(108 162 216 324 432)

for i in "${!DENSITIES[@]}"; do
  density="${DENSITIES[$i]}"
  lsize="${LEGACY_SIZES[$i]}"
  fsize="${FG_SIZES[$i]}"
  out_dir="$RES_DIR/mipmap-$density"
  mkdir -p "$out_dir"
  half=$((lsize / 2))

  # ic_launcher：方形
  magick "$ANDROID_SRC" -resize "${lsize}x${lsize}" "$out_dir/ic_launcher.png"

  # ic_launcher_round：圆形裁剪
  magick "$ANDROID_SRC" -resize "${lsize}x${lsize}" \
    \( -size "${lsize}x${lsize}" xc:none -fill white -draw "circle ${half},${half} ${half},0" \) \
    -alpha set -compose CopyOpacity -composite \
    "$out_dir/ic_launcher_round.png"

  # ic_launcher_foreground：adaptive icon 前景
  magick "$TMP_FG" -resize "${fsize}x${fsize}" "$out_dir/ic_launcher_foreground.png"

  echo "✓ mipmap-$density: ic_launcher(${lsize}) / round(${lsize}) / foreground(${fsize})"
done

echo "Android icons generated from: $SRC_PNG"
