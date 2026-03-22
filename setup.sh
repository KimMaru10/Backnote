#!/bin/bash

# =============================================================================
# Claude Code Review セットアップスクリプト
# 案件ごとの言語・フレームワークに合わせた CLAUDE.md を生成します
# 使い方: bash setup.sh
# =============================================================================

set -e

CLAUDE_MD="CLAUDE.md"
CODING_STANDARDS="CODING_STANDARDS.md"
BOLD="\033[1m"
CYAN="\033[36m"
GREEN="\033[32m"
YELLOW="\033[33m"
RESET="\033[0m"

# --------------------------------------------------
# CODING_STANDARDS.md からセクションを抽出する関数
# 「## セクション名」から次の「---」までを取得
# --------------------------------------------------
extract_section() {
  local file="$1"
  local section_name="$2"
  if [ ! -f "$file" ]; then
    return
  fi
  awk -v section="## ${section_name}" '
    $0 == section { found=1 }
    found && /^---$/ { exit }
    found { print }
  ' "$file"
}

echo ""
echo -e "${BOLD}${CYAN}========================================${RESET}"
echo -e "${BOLD}${CYAN}  Claude Code Review セットアップ${RESET}"
echo -e "${BOLD}${CYAN}========================================${RESET}"
echo ""

# --------------------------------------------------
# 1. プロジェクト基本情報
# --------------------------------------------------
echo -e "${BOLD}【1/5】プロジェクト基本情報${RESET}"
echo ""

read -p "プロジェクト名: " PROJECT_NAME
read -p "プロジェクトの説明（任意）: " PROJECT_DESC

# --------------------------------------------------
# 2. 言語選択（複数可）
# --------------------------------------------------
echo ""
echo -e "${BOLD}【2/5】使用言語を選択してください（複数選択可）${RESET}"
echo ""
echo "  1) TypeScript / JavaScript"
echo "  2) Python"
echo "  3) Go"
echo "  4) Ruby"
echo "  5) Java / Kotlin"
echo "  6) PHP"
echo "  7) Swift"
echo "  8) その他"
echo ""
read -p "番号をスペース区切りで入力（例: 1 2）: " LANG_INPUT

# 選択されたセクション名を追跡
SELECTED_SECTIONS=()
CUSTOM_LANG_RULES=""

for num in $LANG_INPUT; do
  case $num in
    1) SELECTED_SECTIONS+=("TypeScript / JavaScript" "HTML / CSS（フロントエンド共通）") ;;
    2) SELECTED_SECTIONS+=("Python") ;;
    3) SELECTED_SECTIONS+=("Go") ;;
    4) SELECTED_SECTIONS+=("Ruby / Ruby on Rails") ;;
    5) SELECTED_SECTIONS+=("Java / Kotlin") ;;
    6) SELECTED_SECTIONS+=("PHP / CakePHP") ;;
    7) SELECTED_SECTIONS+=("Swift") ;;
    8)
      echo ""
      read -p "言語名を入力: " CUSTOM_LANG
      read -p "そのルールを記述（任意、Enterでスキップ）: " CUSTOM_RULE
      CUSTOM_LANG_RULES="${CUSTOM_LANG_RULES}
### ${CUSTOM_LANG}
${CUSTOM_RULE}
"
      ;;
  esac
done

# --------------------------------------------------
# 3. フレームワーク選択（複数可）
# --------------------------------------------------
echo ""
echo -e "${BOLD}【3/5】使用フレームワークを選択してください（複数選択可）${RESET}"
echo ""
echo "  1) React / Next.js"
echo "  2) Vue.js / Nuxt.js"
echo "  3) Django / FastAPI"
echo "  4) Ruby on Rails"
echo "  5) Laravel"
echo "  6) Spring Boot"
echo "  7) Express / NestJS"
echo "  8) CakePHP"
echo "  9) なし / その他"
echo ""
read -p "番号をスペース区切りで入力（例: 1 8）: " FW_INPUT

CUSTOM_FW_RULES=""

for num in $FW_INPUT; do
  case $num in
    1) SELECTED_SECTIONS+=("React / Next.js") ;;
    2) SELECTED_SECTIONS+=("Vue.js / Nuxt.js") ;;
    3) SELECTED_SECTIONS+=("Django / FastAPI") ;;
    4)
      # Ruby on Railsは「Ruby / Ruby on Rails」セクションに含まれる
      local_found=false
      for s in "${SELECTED_SECTIONS[@]}"; do
        if [ "$s" = "Ruby / Ruby on Rails" ]; then
          local_found=true
          break
        fi
      done
      if [ "$local_found" = false ]; then
        SELECTED_SECTIONS+=("Ruby / Ruby on Rails")
      fi
      ;;
    5) SELECTED_SECTIONS+=("Laravel") ;;
    6) SELECTED_SECTIONS+=("Spring Boot") ;;
    7) SELECTED_SECTIONS+=("Express / NestJS") ;;
    8)
      # CakePHPは「PHP / CakePHP」セクションに含まれる
      local_found=false
      for s in "${SELECTED_SECTIONS[@]}"; do
        if [ "$s" = "PHP / CakePHP" ]; then
          local_found=true
          break
        fi
      done
      if [ "$local_found" = false ]; then
        SELECTED_SECTIONS+=("PHP / CakePHP")
      fi
      ;;
    9)
      echo ""
      read -p "フレームワーク名を入力（なしの場合はEnter）: " CUSTOM_FW
      if [ -n "$CUSTOM_FW" ]; then
        read -p "そのルールを記述（任意、Enterでスキップ）: " CUSTOM_FW_RULE
        CUSTOM_FW_RULES="${CUSTOM_FW_RULES}
### ${CUSTOM_FW}
${CUSTOM_FW_RULE}
"
      fi
      ;;
  esac
done

# --------------------------------------------------
# 4. SEOチェックを含めるか
# --------------------------------------------------
echo ""
echo -e "${BOLD}【4/5】SEOチェック基準をレビューに含めますか？${RESET}"
echo ""
echo "  1) 含める（HTMLに関する項目のみ・コードで検証可能な項目）"
echo "  2) 含めない"
echo ""
read -p "番号を入力: " SEO_INPUT

SEO_RULES=""
if [ "$SEO_INPUT" = "1" ]; then
  SEO_RULES="enabled"
  # SEO有効時、HTML/CSSセクションも含める
  local_found=false
  for s in "${SELECTED_SECTIONS[@]}"; do
    if [ "$s" = "HTML / CSS（フロントエンド共通）" ]; then
      local_found=true
      break
    fi
  done
  if [ "$local_found" = false ]; then
    SELECTED_SECTIONS+=("HTML / CSS（フロントエンド共通）")
  fi
fi

# --------------------------------------------------
# 5. チーム独自ルール
# --------------------------------------------------
echo ""
echo -e "${BOLD}【5/5】チーム独自ルール（任意）${RESET}"
echo ""
read -p "独自ルールがあれば入力（Enterでスキップ）: " CUSTOM_RULES

# --------------------------------------------------
# CODING_STANDARDS.md からセクションを抽出
# --------------------------------------------------
EXTRACTED_STANDARDS=""

if [ -f "$CODING_STANDARDS" ]; then
  # 全言語共通は常に含める
  COMMON_SECTION=$(extract_section "$CODING_STANDARDS" "全言語共通")
  if [ -n "$COMMON_SECTION" ]; then
    EXTRACTED_STANDARDS="${COMMON_SECTION}

---
"
  fi

  # 重複を除去してセクションを抽出
  SEEN_SECTIONS=()
  for section in "${SELECTED_SECTIONS[@]}"; do
    # 既に抽出済みかチェック
    already_seen=false
    for seen in "${SEEN_SECTIONS[@]}"; do
      if [ "$seen" = "$section" ]; then
        already_seen=true
        break
      fi
    done
    if [ "$already_seen" = true ]; then
      continue
    fi
    SEEN_SECTIONS+=("$section")

    SECTION_CONTENT=$(extract_section "$CODING_STANDARDS" "$section")
    if [ -n "$SECTION_CONTENT" ]; then
      EXTRACTED_STANDARDS="${EXTRACTED_STANDARDS}
${SECTION_CONTENT}

---
"
    fi
  done
else
  echo ""
  echo -e "${YELLOW}  ⚠️  CODING_STANDARDS.md が見つかりません。コード規約はスキップされます。${RESET}"
fi

# --------------------------------------------------
# CLAUDE.md 生成
# --------------------------------------------------
echo ""
echo -e "${YELLOW}CLAUDE.md を生成しています...${RESET}"

cat > "$CLAUDE_MD" << MARKDOWN
# Claude への指示書

# currentDate
Today's date is $(date +%Y-%m-%d).

## プロジェクト概要
- **プロジェクト名**: ${PROJECT_NAME}
$([ -n "$PROJECT_DESC" ] && echo "- **説明**: ${PROJECT_DESC}")

---

## Code Review Guidelines（コードレビューの指針）

### 共通チェック観点
- **可読性**: 変数名・関数名は分かりやすいか、コメントは適切か
- **パフォーマンス**: 無駄なループや非効率な処理はないか
- **セキュリティ**: SQLインジェクション・XSS・認証バイパスのリスクはないか
- **エラーハンドリング**: 例外・エラーが適切に処理されているか
- **テスト**: 新機能にテストが書かれているか

### 重要度の表記
- 🔴 **Critical** — バグやセキュリティ脆弱性など、必ず修正が必要な問題
- 🟡 **Warning** — 修正を推奨する問題（パフォーマンス・保守性など）
- 🔵 **Suggestion** — より良くなる提案（任意対応でOK）

### 出力フォーマット
- 問題箇所はファイル名と行番号を明記すること
- 良かった点も必ず1〜2点コメントすること
- 問題がなければ \`✅ LGTM\` と一言添えること

---
$([ -n "$EXTRACTED_STANDARDS" ] && echo "
## コード規約

${EXTRACTED_STANDARDS}")
$([ -n "$CUSTOM_LANG_RULES" ] && echo "
## カスタム言語ルール
${CUSTOM_LANG_RULES}
---")
$([ -n "$CUSTOM_FW_RULES" ] && echo "
## カスタムフレームワークルール
${CUSTOM_FW_RULES}
---")
$([ -n "$CUSTOM_RULES" ] && echo "
## チーム独自ルール
${CUSTOM_RULES}

---")
$([ "$SEO_RULES" = "enabled" ] && cat << 'SEOBLOCK'

## SEO チェックガイドライン

HTMLファイルが変更されているPRでは、以下のSEOチェック項目を確認してください。
コードで検証できる項目のみを対象とし、キーワード選定など運用面の判断は含みません。

### title / meta 関連（No.11〜17）
- `<title>` にSEOキーワードが含まれているか（全角30文字程度を目安）
- `<title>` にキーワードが過剰に詰め込まれていないか（スパム判定リスク）
- `<title>` はページごとに固有の内容になっているか
- `<title>` にテキスト以外（画像など）が指定されていないか
- `<meta name="description">` が設定されており、120文字前後に収まっているか
- `<meta name="description">` にSEOキーワードが含まれているか
- `<meta name="description">` はページごとに固有の内容になっているか

### 見出し・構造（No.18〜21）
- `h1`〜`h6` が正しい階層構造になっているか（h1→h2→h3の順を守る）
- `h` 要素にテキスト以外（画像のみなど）が使われていないか（alt属性があれば許容）
- `h1` が1ページに1つだけか
- `h1` はページごとに固有の内容になっているか

### 画像・リンク（No.23〜24）
- `<img>` に `alt` 属性が設定されているか（空altは装飾画像として許容）
- `<a>` のアンカーテキストが「こちら」「詳しくは」などの非説明的なテキストになっていないか

### 構造化・正規化（No.25〜28、38）
- パンくずリストに構造化マークアップ（JSON-LD / microdata）が設定されているか
- `canonical` タグが設定されているか
- ページネーションがある場合、`rel="prev"` / `rel="next"` が設定されているか
- 隠しテキスト・隠しリンク（背景色と同色テキストなど）がないか

### 技術面（No.33〜34、41〜43）
- SSL（https）対応になっているか（`http://` のハードコードがないか）
- `robots.txt` でGooglebotをブロックする設定になっていないか
- viewport メタタグが設定されており、モバイルフレンドリー対応されているか
- 構造化データ（JSON-LD）が実装されているか（対象ページの場合）
- URLが変更・削除されている場合、301リダイレクト設定が含まれているか
- リダイレクトチェーンが5回を超えていないか

### SEOレビューの出力フォーマット
問題がある場合は通常のコードレビューと同じ重要度表記で記載すること。
- 🔴 Critical: canonical未設定、h1が複数など
- 🟡 Warning: alt属性の欠落、title文字数超過など
- 🔵 Suggestion: 構造化データの追加推奨など

SEOBLOCK
)
MARKDOWN

echo ""
echo -e "${GREEN}${BOLD}✅ CLAUDE.md を生成しました！${RESET}"
echo ""
echo -e "${BOLD}次のステップ:${RESET}"
echo "  1. CLAUDE.md の内容を確認・必要に応じて編集"
echo "  2. GitHub Secretsに以下を登録:"
echo "     - CLAUDE_CODE_OAUTH_TOKEN（またはANTHROPIC_API_KEY）"
echo "     - USER_PAT"
echo "     - CHATWORK_API_TOKEN"
echo "     - CHATWORK_ROOM_ID"
echo "  3. Claude GitHub App のインストール:"
echo "     https://github.com/apps/claude"
echo ""
