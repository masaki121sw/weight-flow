#!/bin/bash
# Weight Flow: 最新の変更を GitHub の main ブランチにプッシュするスクリプト
#
# 使い方:
#   ./deploy-to-main.sh                     # 現在のブランチを main にマージ
#   ./deploy-to-main.sh feature/my-branch   # 指定ブランチを main にマージ

set -e
cd "$(dirname "$0")"

# マージ元ブランチを引数 or 現在のブランチから取得
SOURCE_BRANCH="${1:-$(git branch --show-current)}"

if [ "$SOURCE_BRANCH" = "main" ]; then
  echo "⚠️  現在 main ブランチにいます。マージ元ブランチを引数で指定してください。"
  echo "   例: ./deploy-to-main.sh feature/my-branch"
  exit 1
fi

echo "✅ マージ元ブランチ: $SOURCE_BRANCH"
echo "📦 $SOURCE_BRANCH の内容を main にマージして GitHub へプッシュします..."

# HEAD.lock が残っていれば削除
rm -f .git/HEAD.lock 2>/dev/null || true

# main ブランチに切り替え
git checkout main

# 指定ブランチの内容を main にマージ
git merge "$SOURCE_BRANCH" --no-edit

# GitHub へプッシュ
git push origin main

echo ""
echo "🎉 完了！GitHub の main ブランチが最新になりました。"
echo "   Netlify が自動的にデプロイを開始します。"
