#!/bin/bash
# poker-chips + poker-odds 統合デプロイスクリプト
# 使い方: bash deploy.sh "コミットメッセージ"
# メッセージ省略時は "update" になります

MSG="${1:-update}"
cd "$(dirname "$0")"

echo "=== ポーカーチップス クライアントビルド ==="
cd client && npm run build
if [ $? -ne 0 ]; then
  echo "クライアントのビルドに失敗しました"
  exit 1
fi
cd ..

echo "=== ポーカーオッズ クライアントビルド ==="
cd odds-client && npm run build
if [ $? -ne 0 ]; then
  echo "オッズクライアントのビルドに失敗しました"
  exit 1
fi
cd ..

echo "=== サーバービルド ==="
cd server && npx tsc
if [ $? -ne 0 ]; then
  echo "サーバーのビルドに失敗しました"
  exit 1
fi
cd ..

echo "=== Git push ==="
git add -A
git commit -m "$MSG"
git push origin main

echo "デプロイ完了！"
echo "  チップス: https://your-app.onrender.com/"
echo "  オッズ:   https://your-app.onrender.com/odds/"
