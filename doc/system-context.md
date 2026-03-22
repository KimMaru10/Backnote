# システム関連図（System Context Diagram）

## 概要
PeelTaskのシステム境界と、外部アクター・外部システムとの関係を示す。

## システム関連図

```mermaid
graph TB
    User["👤 ユーザー"]

    subgraph PeelTask["🖥️ PeelTask（デスクトップアプリ）"]
        direction TB

        subgraph Electron["Electron"]
            MainProcess["Main Process<br/>・Goプロセス起動/終了管理<br/>・IPC通信<br/>・APIキー暗号化保存（electron-store）"]
            Preload["Preload Script<br/>・IPCブリッジ"]
            Renderer["Renderer Process<br/>・React + TailwindCSS<br/>・付箋UI / リスト / ガント / カレンダー"]
        end

        subgraph GoBackend["Go Backend（子プロセス）"]
            Echo["Echo Server<br/>localhost:8080"]
            Scoring["Scoring Engine<br/>優先度スコアリング"]
            Scheduler["Scheduler Engine<br/>スケジュール自動生成"]
            BacklogClient["Backlog Client<br/>goroutine並行取得"]
        end

        SQLite[("SQLite<br/>ローカルDB")]
    end

    BacklogAPI["☁️ Backlog API<br/>（Nulab）"]

    User -->|"操作"| Renderer
    Renderer -->|"IPC"| Preload
    Preload -->|"IPC"| MainProcess
    MainProcess -->|"子プロセス起動/終了"| Echo
    Renderer -->|"HTTP REST<br/>localhost:8080"| Echo
    Echo --> Scoring
    Echo --> Scheduler
    Echo --> BacklogClient
    BacklogClient -->|"HTTPS<br/>APIキー認証"| BacklogAPI
    Echo -->|"GORM"| SQLite
    MainProcess -->|"APIキー暗号化保存"| Renderer
```

## 通信フロー

```mermaid
sequenceDiagram
    participant U as ユーザー
    participant R as Renderer<br/>(React)
    participant M as Main Process<br/>(Electron)
    participant G as Go Backend<br/>(Echo)
    participant DB as SQLite
    participant B as Backlog API

    Note over M,G: アプリ起動時
    M->>G: 子プロセスとして起動
    G->>DB: DBマイグレーション
    G-->>M: localhost:8080 Ready

    Note over U,B: タスク同期フロー
    U->>R: 同期ボタン押下
    R->>G: GET /api/sync
    G->>B: 複数スペースへgoroutine並行リクエスト
    B-->>G: タスクデータ（JSON）
    G->>G: スコアリング計算
    G->>DB: タスク保存/更新
    G->>G: スケジュール自動生成
    G->>DB: スケジュール保存
    G-->>R: 200 OK

    Note over U,R: タスク完了フロー
    U->>R: 付箋の完了ボタン押下
    R->>R: 剥がしアニメーション（300ms）
    R->>G: PATCH /api/tasks/:id/complete
    G->>DB: ステータス更新
    G-->>R: 200 OK
```

## 外部依存

| 外部システム | 通信方式 | 認証 | 備考 |
|---|---|---|---|
| Backlog API（Nulab） | HTTPS | APIキー | ユーザーが各自設定。electron-storeで暗号化保存 |
| ファイルシステム | ローカル | なし | SQLiteファイル保存先 |

## 補足
- Go BackendはElectron Main Processの子プロセスとして起動され、アプリ終了時に自動停止する
- すべての通信はローカル（localhost）で完結。外部サーバーへの公開は不要
- Backlog APIへのリクエストはユーザーのPCから直接送信される（中間サーバーなし）
- 15分ごとにバックグラウンドでBacklog APIと自動同期
