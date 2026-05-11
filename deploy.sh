#!/bin/bash
# 使い方: ./deploy.sh "コミットメッセージ"
# メッセージ省略時は "update" になります

MSG="${1:-update}"
cd "$(dirname "$0")"
git add .
git commit -m "$MSG"
git push origin main
