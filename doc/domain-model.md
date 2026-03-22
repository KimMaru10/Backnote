# ドメインモデル図（Domain Model Diagram）

## 概要
PeelTaskの主要エンティティとその関連、属性を示す。

## ドメインモデル図

```mermaid
classDiagram
    class BacklogSpace {
        +uint ID
        +string Domain
        +string ApiKeyRef
        +string Color
        +string DisplayName
        +bool IsActive
        +time CreatedAt
        +time UpdatedAt
    }

    class Task {
        +uint ID
        +string IssueKey
        +string Title
        +string Description
        +string Priority
        +float64 EstimatedHours
        +time DueDate
        +string Status
        +uint SpaceID
        +float64 Score
        +string MilestoneID
        +time MilestoneDueDate
        +time SyncedAt
        +time CreatedAt
        +time UpdatedAt
    }

    class Schedule {
        +uint ID
        +time Date
        +float64 TotalHours
        +float64 AllocatedHours
        +time CreatedAt
        +time UpdatedAt
    }

    class ScheduleSlot {
        +uint ID
        +uint ScheduleID
        +uint TaskID
        +time StartAt
        +time EndAt
        +int OrderIndex
        +time CreatedAt
        +time UpdatedAt
    }

    class Category {
        +uint ID
        +string Name
        +string Color
        +time CreatedAt
    }

    class TaskCategory {
        +uint TaskID
        +uint CategoryID
    }

    BacklogSpace "1" --> "*" Task : has
    Schedule "1" --> "*" ScheduleSlot : contains
    Task "1" --> "*" ScheduleSlot : assigned to
    Task "*" --> "*" Category : tagged with
    Task "*" -- "*" Category : through TaskCategory
```

## エンティティ詳細

### BacklogSpace（Backlogスペース）
Backlogの接続先スペースを管理するエンティティ。

| 属性 | 型 | 説明 |
|---|---|---|
| ID | uint | 主キー |
| Domain | string | Backlogスペースのドメイン（例: `myteam.backlog.com`） |
| ApiKeyRef | string | electron-storeの暗号化キー参照ID（APIキー本体はelectron-storeに保存） |
| Color | string | UI表示用カラーコード（例: `#FF6B6B`） |
| DisplayName | string | UI表示名（例: 「開発チームA」） |
| IsActive | bool | 同期対象かどうか |

### Task（タスク）
Backlogから取得した課題を表すエンティティ。スコアリング結果を保持する。

| 属性 | 型 | 説明 |
|---|---|---|
| ID | uint | 主キー |
| IssueKey | string | Backlogの課題キー（例: `PROJ-123`） |
| Title | string | タスクタイトル |
| Priority | string | Backlog優先度（高/中/低） |
| EstimatedHours | float64 | 見積もり時間 |
| DueDate | time | 期限日 |
| Status | string | ステータス（未対応/処理中/完了 等） |
| SpaceID | uint | 所属スペースID（FK → BacklogSpace） |
| Score | float64 | 算出された優先度スコア |
| MilestoneDueDate | time | マイルストーンの期限日 |
| SyncedAt | time | 最終同期日時 |

### Schedule（スケジュール）
日単位のスケジュール枠。1日8時間を上限とする。

| 属性 | 型 | 説明 |
|---|---|---|
| ID | uint | 主キー |
| Date | time | 対象日 |
| TotalHours | float64 | 1日の総作業時間（デフォルト: 8.0） |
| AllocatedHours | float64 | 割り当て済み時間の合計 |

### ScheduleSlot（スケジュールスロット）
スケジュール内の個別タスク割り当て枠。

| 属性 | 型 | 説明 |
|---|---|---|
| ID | uint | 主キー |
| ScheduleID | uint | 所属スケジュールID（FK → Schedule） |
| TaskID | uint | 割り当てタスクID（FK → Task） |
| StartAt | time | 開始時刻 |
| EndAt | time | 終了時刻 |
| OrderIndex | int | 表示順序（ドラッグ&ドロップで変更可能） |

### Category（カテゴリ）
タスクの分類タグ。

| 属性 | 型 | 説明 |
|---|---|---|
| ID | uint | 主キー |
| Name | string | カテゴリ名 |
| Color | string | UI表示用カラーコード |

## スコアリングロジックの位置づけ

```mermaid
flowchart LR
    Task -->|"入力"| ScoringEngine
    ScoringEngine -->|"Score値を更新"| Task

    subgraph ScoringEngine["スコアリングエンジン（scoring.go）"]
        D["期限緊急度<br/>1.0 / max(残り日数, 0.5)<br/>× 0.5"]
        P["Backlog優先度<br/>高=1.0 / 中=0.6 / 低=0.3<br/>× 0.3"]
        E["工数ペナルティ<br/>1.0 / max(見積もり時間, 1.0)<br/>× 0.1"]
        M["マイルストーン近接<br/>7日以内=1.0 / 他=0.0<br/>× 0.1"]
    end
```

**スコア計算式:**
```
score = 期限緊急度 × 0.5 + Backlog優先度 × 0.3 + 工数ペナルティ × 0.1 + マイルストーン近接 × 0.1
```

## スケジュール生成ロジックの位置づけ

```mermaid
flowchart TD
    Tasks["タスク一覧<br/>（Score降順）"] --> Scheduler["スケジューラ（scheduler.go）"]
    Scheduler --> S1["Schedule: 2026-03-23<br/>TotalHours: 8.0"]
    Scheduler --> S2["Schedule: 2026-03-24<br/>TotalHours: 8.0"]
    S1 --> Slot1["Slot: タスクA（3h）"]
    S1 --> Slot2["Slot: タスクB（4h）"]
    S1 --> Slot3["Slot: タスクC（1h）"]
    S2 --> Slot4["Slot: タスクD（5h）"]
    S2 --> Slot5["Slot: タスクE（3h）"]

    style Scheduler fill:#FAC775
```

- スコアの高いタスクから順に、当日の8h枠に割り当て
- 枠が溢れたら翌日に繰り越し
