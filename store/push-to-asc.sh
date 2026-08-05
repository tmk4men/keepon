#!/usr/bin/env bash
# App Store Connect に課金商品と掲載文を流す。
#
# appId は bundleId から自動で引くので、手で写す必要はない。
# 先に App Store Connect でアプリレコードを作っておくこと（レコードが無いと appId は存在しない）。
#
#   ./store/push-to-asc.sh          下見（何も送らない）
#   ./store/push-to-asc.sh --yes    反映
#
# 必要なもの: ~/.asc/ に鍵と config.json、asc コマンド（appstore-connect スキル）

set -euo pipefail

BUNDLE_ID="app.tuzukin.diet"
CONFIG="$(cd "$(dirname "$0")" && pwd)/asc.tuzukin.json"

if ! command -v asc >/dev/null 2>&1; then
  echo "asc コマンドが見つかりません。" >&2
  echo "  mkdir -p ~/asc-tools && cp -R ~/.claude/skills/appstore-connect/scripts/* ~/asc-tools/" >&2
  echo "  cd ~/asc-tools && npm link" >&2
  exit 1
fi

# asc apps の出力は  id \t 名前 \t bundleId \t [sku]
APP_ID="$(asc apps | awk -F'\t' -v b="$BUNDLE_ID" '$3 == b { print $1; exit }')"

if [ -z "$APP_ID" ]; then
  echo "bundleId $BUNDLE_ID のアプリが見つかりません。" >&2
  echo "App Store Connect でアプリレコードを作ってから、もう一度実行してください。" >&2
  echo "（今そのアカウントに見えているアプリ）" >&2
  asc apps >&2
  exit 1
fi

echo "appId: $APP_ID（$BUNDLE_ID）"
echo

if [ "${1:-}" = "--yes" ]; then
  asc-setup "$CONFIG" "$APP_ID" --yes
else
  echo "※ 下見です。実際に送るには --yes を付けてください。"
  echo
  asc-setup "$CONFIG" "$APP_ID"
fi
