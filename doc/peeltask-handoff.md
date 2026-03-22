# PeelTask — Claude Code 引き継ぎプロンプト（最終版）

## プロジェクト概要
Backlog（nulab）の複数スペースからタスクを取得し、
Goのロジックで優先度スコアリング・スケジュール自動生成する
Electronデスクトップアプリ。

タスクを「付箋を剥がす」感覚で完了していくUXが特徴。

## リポジトリ名
`peeltask`

## ロゴ / アイコン
- ファイル: `peeltask-logo.svg`
- デザイン: 黄色の角丸正方形 + 右上めくれ（白三角）+ 「P」の文字
- メインカラー: #FAC775（付箋イエロー）/ #BA7517（テキスト）

## 技術スタック
- Electron + React (Renderer Process) — UI
- Go (Echo) — バックエンドAPI・スコアリング・スケジュール生成
  localhost:8080、Electron Main Processから子プロセス起動
- SQLite + GORM — ローカルDB（オフライン対応）
- TailwindCSS — UIスタイリング
- electron-store — APIキー暗号化保存
- electron-vite — ビルドツール

※ FastAPIは使用しない。優先度算出はGoのロジックで完結。

## 優先度スコアリングロジック（Go）

score = 期限緊急度×0.5 + Backlog優先度×0.3 + 工数ペナルティ×0.1 + マイルストーン近接×0.1

- 期限緊急度   : 1.0 / max(残り日数, 0.5)
- Backlog優先度 : 高=1.0 / 中=0.6 / 低=0.3
- 工数ペナルティ: 1.0 / max(見積もり時間, 1.0)
- マイルストーン: 7日以内なら1.0、それ以外0.0

## ドメインモデル（主要エンティティ）
- BacklogSpace : スペース接続設定（domain, apiKey, color, displayName）
- Task         : Backlogから取得した課題
                 （issueKey, title, priority, estimatedHours, dueDate, status, spaceId, score）
- Schedule     : 生成されたスケジュール（日付単位）
- ScheduleSlot : スケジュール内のタスク枠（startAt, endAt, orderIndex）
- Category     : タスク分類タグ

## 主要機能
1. Backlog複数スペース登録・APIキー管理（electron-storeで暗号化保存）
2. goroutineによる複数スペース並行タスク取得・SQLiteキャッシュ（15分ごと同期）
3. Goロジックによる優先度スコアリング（期限×優先度×工数×マイルストーン）
4. スケジュール自動生成（1日8h枠、スコア順に割り当て・翌日繰り越し）
5. 3種のスケジュール表示
   - リスト形式（今日 / 今週 / 来週）
   - ガントチャート（react-beautiful-dnd でドラッグ調整）
   - カレンダー（週 / 月）
6. タスク完了時に付箋を剥がすアニメーション（UXの核心）

## フォルダ構成
```
peeltask/
├── electron/
│   ├── main.ts          # Main Process・Goプロセス起動・終了管理
│   └── preload.ts       # IPC ブリッジ
├── renderer/            # React + Vite + TailwindCSS
│   └── src/
│       ├── components/
│       │   ├── StickyCard.tsx      # 付箋カードコンポーネント（剥がしアニメ付き）
│       │   ├── ListView.tsx        # 今日/今週/来週リスト
│       │   ├── GanttChart.tsx      # ガントチャート
│       │   └── CalendarView.tsx    # 週/月カレンダー
│       └── pages/
│           ├── Dashboard.tsx
│           └── Settings.tsx        # スペース設定・APIキー管理
├── backend/             # Go (Echo + GORM)
│   ├── cmd/main.go
│   └── internal/
│       ├── handler/     # APIエンドポイント
│       ├── model/       # Task, BacklogSpace, Schedule...
│       ├── service/
│       │   ├── backlog.go    # Backlog API取得（goroutine並行）
│       │   ├── scoring.go    # 優先度スコアリング
│       │   └── scheduler.go  # スケジュール生成エンジン
│       └── store/       # SQLite操作
├── assets/
│   └── peeltask-logo.svg
└── package.json
```

## 付箋剥がしアニメーションの仕様（StickyCard.tsx）
- 完了ボタンを押すと右上がめくれるように transform + opacity でアニメーション
- アニメーション時間: 300ms
- 完了後: カードがスタックから消え、下のカードが上にスライド

```tsx
// アニメーションイメージ
const peel = keyframes`
  0%   { transform: rotate(0deg) scale(1);   opacity: 1; }
  60%  { transform: rotate(-4deg) scale(1.04); opacity: 0.8; }
  100% { transform: rotate(8deg) scale(0.7) translateY(-40px); opacity: 0; }
`;
```

## 開発優先順位
1. electron-vite で Electron + React 初期セットアップ
2. Go + Echo プロジェクト初期化・SQLiteスキーマ作成
3. Electron Main Process から Go バイナリを子プロセス起動
4. Backlog API接続・複数スペース並行取得（goroutine）
5. 優先度スコアリングロジック実装（scoring.go）
6. スケジュール自動生成エンジン（scheduler.go）
7. StickyCard.tsx — 付箋UIと剥がしアニメーション
8. リスト表示 → ガント → カレンダーの順

## 最初に作るファイル
`electron/main.ts` から開始し、
Goバックエンドを子プロセスとして起動・終了管理するコードを実装してください。
