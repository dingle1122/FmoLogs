#!/bin/bash
set -euo pipefail

resolve_update_manifest_url() {
  if [ -n "${VITE_ANDROID_UPDATE_MANIFEST_URL:-}" ]; then
    echo "$VITE_ANDROID_UPDATE_MANIFEST_URL"
    return
  fi

  if [ -n "${QINIU_PUBLIC_BASE_URL:-}" ] && [ -n "${QINIU_RELEASE_PREFIX:-}" ]; then
    local base="${QINIU_PUBLIC_BASE_URL%/}"
    local prefix="${QINIU_RELEASE_PREFIX#/}"
    prefix="${prefix%/}"
    echo "${base}/${prefix}/latest.json"
  fi
}

UPDATE_MANIFEST_URL="$(resolve_update_manifest_url)"
if [ -n "$UPDATE_MANIFEST_URL" ]; then
  export VITE_ANDROID_UPDATE_MANIFEST_URL="$UPDATE_MANIFEST_URL"
  echo "更新检查地址: $VITE_ANDROID_UPDATE_MANIFEST_URL"
else
  echo "未配置更新检查地址，打包后的 App 不会显示检查更新入口"
fi

npm run build
