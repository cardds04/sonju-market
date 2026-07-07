#!/bin/bash
# 손주마켓 서버 배포 — wrangler login 이후 실행하면 KV 생성→연결→배포까지 한 번에
set -e
cd "$(dirname "$0")"

echo "▶ 1) KV 네임스페이스 생성"
OUT=$(npx --yes wrangler kv namespace create ORDERS 2>&1) || true
echo "$OUT"
KVID=$(echo "$OUT" | grep -oE '"?id"?[ =:]+"?[a-f0-9]{32}"?' | grep -oE '[a-f0-9]{32}' | head -1)

if [ -z "$KVID" ]; then
  echo "⚠ KV id를 못 찾음(이미 있을 수 있음). 아래로 확인:"
  npx --yes wrangler kv namespace list 2>&1 | grep -A1 ORDERS || true
  echo "→ 위 id를 wrangler.toml 의 PLACEHOLDER_KV_ID 자리에 넣고 다시 실행하세요."
  exit 1
fi

echo "▶ 2) wrangler.toml 에 KV id 연결: $KVID"
sed -i '' "s/PLACEHOLDER_KV_ID/$KVID/" wrangler.toml 2>/dev/null || sed -i "s/PLACEHOLDER_KV_ID/$KVID/" wrangler.toml

echo "▶ 3) Worker 배포"
npx --yes wrangler deploy 2>&1 | tee /tmp/sonju_deploy.log

echo ""
echo "✅ 배포 완료. 아래 workers.dev 주소를 store.js 의 API_BASE 에 넣으세요:"
grep -oE 'https://[a-z0-9.-]+\.workers\.dev' /tmp/sonju_deploy.log | head -1
