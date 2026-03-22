# オブジェクト図（Object Diagram）

## 概要
ドメインモデルの具体的なインスタンス例を示し、データがどのように関連するかを可視化する。

## シナリオ
ユーザーが2つのBacklogスペースを登録し、3つのタスクが同期済み。
2026年3月23日（月）のスケジュールが自動生成された状態。

## オブジェクト図

```mermaid
graph TB
    subgraph Spaces["BacklogSpace"]
        Space1["space1: BacklogSpace<br/>─────────────<br/>ID: 1<br/>Domain: dev-team.backlog.com<br/>ApiKeyRef: enc_key_001<br/>Color: #FF6B6B<br/>DisplayName: 開発チームA<br/>IsActive: true"]

        Space2["space2: BacklogSpace<br/>─────────────<br/>ID: 2<br/>Domain: design.backlog.com<br/>ApiKeyRef: enc_key_002<br/>Color: #6BCB77<br/>DisplayName: デザインチーム<br/>IsActive: true"]
    end

    subgraph Tasks["Task"]
        Task1["task1: Task<br/>─────────────<br/>ID: 1<br/>IssueKey: DEV-101<br/>Title: ログイン画面のバグ修正<br/>Priority: 高<br/>EstimatedHours: 3.0<br/>DueDate: 2026-03-24<br/>Status: 処理中<br/>SpaceID: 1<br/>Score: 1.63"]

        Task2["task2: Task<br/>─────────────<br/>ID: 2<br/>IssueKey: DEV-205<br/>Title: API認証の改善<br/>Priority: 中<br/>EstimatedHours: 5.0<br/>DueDate: 2026-03-28<br/>Status: 未対応<br/>SpaceID: 1<br/>Score: 0.40"]

        Task3["task3: Task<br/>─────────────<br/>ID: 3<br/>IssueKey: DSG-042<br/>Title: ダッシュボードUI改修<br/>Priority: 高<br/>EstimatedHours: 4.0<br/>DueDate: 2026-03-25<br/>Status: 処理中<br/>SpaceID: 2<br/>Score: 0.98"]
    end

    subgraph Schedules["Schedule"]
        Sched1["schedule1: Schedule<br/>─────────────<br/>ID: 1<br/>Date: 2026-03-23<br/>TotalHours: 8.0<br/>AllocatedHours: 7.0"]
    end

    subgraph Slots["ScheduleSlot"]
        Slot1["slot1: ScheduleSlot<br/>─────────────<br/>ID: 1<br/>ScheduleID: 1<br/>TaskID: 1<br/>StartAt: 09:00<br/>EndAt: 12:00<br/>OrderIndex: 0"]

        Slot2["slot2: ScheduleSlot<br/>─────────────<br/>ID: 2<br/>ScheduleID: 1<br/>TaskID: 3<br/>StartAt: 13:00<br/>EndAt: 17:00<br/>OrderIndex: 1"]
    end

    subgraph Categories["Category"]
        Cat1["cat1: Category<br/>─────────────<br/>ID: 1<br/>Name: バグ修正<br/>Color: #E74C3C"]

        Cat2["cat2: Category<br/>─────────────<br/>ID: 2<br/>Name: UI/UX<br/>Color: #3498DB"]
    end

    Space1 --> Task1
    Space1 --> Task2
    Space2 --> Task3
    Sched1 --> Slot1
    Sched1 --> Slot2
    Slot1 --> Task1
    Slot2 --> Task3
    Task1 --- Cat1
    Task3 --- Cat2

    style Space1 fill:#FF6B6B,color:#fff
    style Space2 fill:#6BCB77,color:#fff
    style Task1 fill:#FAC775
    style Task2 fill:#FAC775
    style Task3 fill:#FAC775
    style Sched1 fill:#DDD
    style Slot1 fill:#EEE
    style Slot2 fill:#EEE
```

## スコアリング計算例

### task1: DEV-101（ログイン画面のバグ修正）

```
前提: 今日 = 2026-03-23

① 期限緊急度 = 1.0 / max(残り日数, 0.5)
   残り日数 = 2026-03-24 - 2026-03-23 = 1日
   → 1.0 / max(1, 0.5) = 1.0

② Backlog優先度 = 高 → 1.0

③ 工数ペナルティ = 1.0 / max(見積もり時間, 1.0)
   → 1.0 / max(3.0, 1.0) = 0.333

④ マイルストーン近接 = マイルストーンなし → 0.0

score = 1.0 × 0.5 + 1.0 × 0.3 + 0.333 × 0.1 + 0.0 × 0.1
      = 0.50 + 0.30 + 0.033 + 0.00
      = 0.833
```

### task2: DEV-205（API認証の改善）

```
① 期限緊急度 = 1.0 / max(5, 0.5) = 0.2
② Backlog優先度 = 中 → 0.6
③ 工数ペナルティ = 1.0 / max(5.0, 1.0) = 0.2
④ マイルストーン近接 = なし → 0.0

score = 0.2 × 0.5 + 0.6 × 0.3 + 0.2 × 0.1 + 0.0 × 0.1
      = 0.10 + 0.18 + 0.02 + 0.00
      = 0.30
```

### task3: DSG-042（ダッシュボードUI改修）

```
① 期限緊急度 = 1.0 / max(2, 0.5) = 0.5
② Backlog優先度 = 高 → 1.0
③ 工数ペナルティ = 1.0 / max(4.0, 1.0) = 0.25
④ マイルストーン近接 = 7日以内のマイルストーンあり → 1.0

score = 0.5 × 0.5 + 1.0 × 0.3 + 0.25 × 0.1 + 1.0 × 0.1
      = 0.25 + 0.30 + 0.025 + 0.10
      = 0.675
```

### スコア順（降順）
| 順位 | タスク | スコア |
|---|---|---|
| 1 | DEV-101 ログイン画面のバグ修正 | 0.833 |
| 2 | DSG-042 ダッシュボードUI改修 | 0.675 |
| 3 | DEV-205 API認証の改善 | 0.30 |

## スケジュール割り当て例

```mermaid
gantt
    title 2026-03-23（月）のスケジュール
    dateFormat HH:mm
    axisFormat %H:%M

    section スコア順割当
    DEV-101 ログイン画面のバグ修正（3h）  :active, 09:00, 3h
    DSG-042 ダッシュボードUI改修（4h）    :active, 13:00, 4h
```

- スコア1位の DEV-101（3h）→ 09:00〜12:00 に配置
- スコア2位の DSG-042（4h）→ 13:00〜17:00 に配置
- 合計 7h / 8h（残り1h枠あり）
- スコア3位の DEV-205（5h）→ 残り1hでは入りきらないため翌日に繰り越し
