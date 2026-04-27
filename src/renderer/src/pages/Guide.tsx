import { Settings, Globe, Key, FolderKanban, User, Building2, RefreshCw, MessageSquare, BarChart3, Calendar, List, Bell, Star, Search } from 'lucide-react'

function Guide(): JSX.Element {
  return (
    <div className="max-w-3xl mx-auto">

      <h1 className="text-2xl font-bold text-gray-800 mb-2">ご利用ガイド</h1>
      <p className="text-gray-500 mb-8">Backnoteの使い方をステップごとに説明します。</p>

      {/* はじめに */}
      <section className="mb-10">
        <h2 className="text-lg font-semibold text-gray-700 mb-3 flex items-center gap-2">
          <span className="w-6 h-6 bg-brand text-white rounded-full text-xs flex items-center justify-center font-bold">1</span>
          Backnoteとは
        </h2>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm text-gray-600 leading-relaxed mb-3">
            BacknoteはBacklog（Nulab）のタスクをデスクトップで一元管理する進捗管理アプリです。
            複数スペース・プロジェクトのタスクを自動で取得し、優先度スコアリングで「今やるべきこと」を可視化します。
          </p>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="bg-green-50 rounded-lg p-3">
              <p className="font-medium text-green-700 mb-1">できること</p>
              <ul className="text-green-600 space-y-1">
                <li>・タスクの閲覧・フィルタリング</li>
                <li>・優先度スコアリング</li>
                <li>・リスト / ガント / カレンダー表示</li>
                <li>・ローカルメモ（進捗管理用）</li>
                <li>・複数スペース・プロジェクト対応</li>
              </ul>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="font-medium text-gray-600 mb-1">Backlog操作は「Webで見る」から</p>
              <ul className="text-gray-500 space-y-1">
                <li>・タスクの完了・ステータス変更</li>
                <li>・コメントの投稿</li>
                <li>・担当者の変更</li>
                <li>→ 「Webで見る」ボタンからBacklogで操作</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* 初期設定 */}
      <section className="mb-10">
        <h2 className="text-lg font-semibold text-gray-700 mb-3 flex items-center gap-2">
          <span className="w-6 h-6 bg-brand text-white rounded-full text-xs flex items-center justify-center font-bold">2</span>
          初期設定
        </h2>

        {/* APIキー取得 */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
          <h3 className="font-medium text-gray-700 mb-3 flex items-center gap-2">
            <Key size={16} className="text-brand" />
            APIキーの取得
          </h3>
          <ol className="text-sm text-gray-600 space-y-2">
            <li className="flex gap-2">
              <span className="text-brand font-bold shrink-0">1.</span>
              <span>Backlogにブラウザでログインします</span>
            </li>
            <li className="flex gap-2">
              <span className="text-brand font-bold shrink-0">2.</span>
              <span>右上のプロフィールアイコン → <strong>「個人設定」</strong>をクリック</span>
            </li>
            <li className="flex gap-2">
              <span className="text-brand font-bold shrink-0">3.</span>
              <span>左メニューから<strong>「API」</strong>を選択</span>
            </li>
            <li className="flex gap-2">
              <span className="text-brand font-bold shrink-0">4.</span>
              <span>メモ欄に「Backnote」と入力し、<strong>「登録」</strong>ボタンをクリック</span>
            </li>
            <li className="flex gap-2">
              <span className="text-brand font-bold shrink-0">5.</span>
              <span>生成されたAPIキーをコピーします</span>
            </li>
          </ol>
        </div>

        {/* ドメイン確認 */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
          <h3 className="font-medium text-gray-700 mb-3 flex items-center gap-2">
            <Globe size={16} className="text-brand" />
            ドメインの確認
          </h3>
          <p className="text-sm text-gray-600 mb-3">
            ブラウザでBacklogを開いた時のURLを確認してください。
          </p>
          <div className="bg-gray-50 rounded-lg p-3 font-mono text-sm mb-3">
            <span className="text-gray-400">https://</span>
            <span className="text-brand font-bold">xxx.backlog.jp</span>
            <span className="text-gray-400">/view/TASK-1</span>
          </div>
          <p className="text-sm text-gray-500">
            <strong className="text-brand">xxx.backlog.jp</strong> の部分がドメインです。
            URLをそのまま貼り付けてもOK — 自動で抽出されます。
          </p>
        </div>

        {/* スペース登録 */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
          <h3 className="font-medium text-gray-700 mb-3 flex items-center gap-2">
            <Settings size={16} className="text-brand" />
            スペースの登録
          </h3>
          <ol className="text-sm text-gray-600 space-y-2">
            <li className="flex gap-2">
              <span className="text-brand font-bold shrink-0">1.</span>
              <span>ヘッダーの<strong>「設定」</strong>を開く</span>
            </li>
            <li className="flex gap-2">
              <span className="text-brand font-bold shrink-0">2.</span>
              <span><strong>「+ スペースを追加」</strong>をクリック</span>
            </li>
            <li className="flex gap-2">
              <span className="text-brand font-bold shrink-0">3.</span>
              <span>表示名・ドメイン・APIキーを入力</span>
            </li>
            <li className="flex gap-2">
              <span className="text-brand font-bold shrink-0">4.</span>
              <span><strong>「接続テスト」</strong>で接続を確認</span>
            </li>
            <li className="flex gap-2">
              <span className="text-brand font-bold shrink-0">5.</span>
              <span>カラーを選択して<strong>「保存」</strong></span>
            </li>
          </ol>
        </div>

        {/* プロジェクト選択 */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-medium text-gray-700 mb-3 flex items-center gap-2">
            <FolderKanban size={16} className="text-brand" />
            プロジェクトの選択（任意）
          </h3>
          <p className="text-sm text-gray-600 mb-2">
            スペース登録後、必要なプロジェクトだけを同期対象にできます。
          </p>
          <ol className="text-sm text-gray-600 space-y-2">
            <li className="flex gap-2">
              <span className="text-brand font-bold shrink-0">1.</span>
              <span>設定画面でスペースの<FolderKanban size={14} className="inline text-brand" />アイコンをクリック</span>
            </li>
            <li className="flex gap-2">
              <span className="text-brand font-bold shrink-0">2.</span>
              <span>取得したいプロジェクトにチェック</span>
            </li>
            <li className="flex gap-2">
              <span className="text-brand font-bold shrink-0">3.</span>
              <span><strong>「保存」</strong>をクリック</span>
            </li>
          </ol>
          <p className="text-xs text-gray-400 mt-2">※ 未選択の場合はスペース内の全プロジェクトが対象です</p>
        </div>
      </section>

      {/* ダッシュボード */}
      <section className="mb-10">
        <h2 className="text-lg font-semibold text-gray-700 mb-3 flex items-center gap-2">
          <span className="w-6 h-6 bg-brand text-white rounded-full text-xs flex items-center justify-center font-bold">3</span>
          ダッシュボードの使い方
        </h2>

        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-5">
          <div>
            <h3 className="font-medium text-gray-700 mb-2 flex items-center gap-2">
              <List size={16} className="text-gray-400" />
              <BarChart3 size={16} className="text-gray-400" />
              <Calendar size={16} className="text-gray-400" />
              表示切り替え
            </h3>
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="font-medium text-gray-700">リスト</p>
                <p className="text-gray-500 text-xs mt-1">カード形式でスコア順に表示</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="font-medium text-gray-700">ガント</p>
                <p className="text-gray-500 text-xs mt-1">14日間のタイムライン</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="font-medium text-gray-700">カレンダー</p>
                <p className="text-gray-500 text-xs mt-1">週/月のカレンダー表示</p>
              </div>
            </div>
          </div>

          <div>
            <h3 className="font-medium text-gray-700 mb-2">フィルター</h3>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>・<strong>スペース</strong> — 複数スペース時に絞り込み</li>
              <li>・<strong>プロジェクト</strong> — issueKeyのプロジェクトキーで絞り込み</li>
              <li>・<strong>期限タブ</strong> — すべて / 期限切れ / 今日 / 今週 / 未来</li>
            </ul>
          </div>

          <div>
            <h3 className="font-medium text-gray-700 mb-2 flex items-center gap-2">
              <User size={16} className="text-gray-400" />
              <Building2 size={16} className="text-gray-400" />
              自分 / 全体切り替え
            </h3>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>・<strong>自分</strong> — 自分に割り当てられたタスクのみ表示</li>
              <li>・<strong>全体</strong> — スペース全体のタスクを表示</li>
            </ul>
          </div>

          <div>
            <h3 className="font-medium text-gray-700 mb-2 flex items-center gap-2">
              <RefreshCw size={16} className="text-gray-400" />
              更新
            </h3>
            <p className="text-sm text-gray-600">
              Backlogから最新のタスクを取得します。15分ごとに自動同期も行われます。
            </p>
          </div>
        </div>
      </section>

      {/* 課題詳細 */}
      <section className="mb-10">
        <h2 className="text-lg font-semibold text-gray-700 mb-3 flex items-center gap-2">
          <span className="w-6 h-6 bg-brand text-white rounded-full text-xs flex items-center justify-center font-bold">4</span>
          課題詳細ページ
        </h2>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <ul className="text-sm text-gray-600 space-y-2">
            <li>・カードをクリックすると詳細ページに遷移します</li>
            <li>・課題の情報（ステータス・優先度・期限・見積もり・スコア）を確認できます</li>
            <li>・<strong>「Webで見る」</strong>ボタンでBacklogの課題ページを直接開けます</li>
            <li>・<strong>ローカルメモ</strong>を残せます（Backlogには送信されません）</li>
          </ul>
          <div className="mt-3 p-3 bg-amber-50 rounded-lg">
            <p className="text-xs text-amber-700 flex items-center gap-1.5">
              <MessageSquare size={14} />
              メモはアプリ内にのみ保存されます。チームに共有する内容はBacklogにコメントしてください。
            </p>
          </div>
        </div>
      </section>

      {/* スコアリング */}
      <section className="mb-10">
        <h2 className="text-lg font-semibold text-gray-700 mb-3 flex items-center gap-2">
          <span className="w-6 h-6 bg-brand text-white rounded-full text-xs flex items-center justify-center font-bold">5</span>
          スコアリングの仕組み
        </h2>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm text-gray-600 mb-4">
            各タスクには優先度スコアが自動計算されます。スコアが高いほど「今やるべきタスク」です。
          </p>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">期限緊急度</span>
              <div className="flex items-center gap-2">
                <div className="w-32 bg-gray-100 rounded-full h-2">
                  <div className="bg-red-400 h-2 rounded-full" style={{ width: '35%' }} />
                </div>
                <span className="text-gray-400 text-xs w-8">35%</span>
              </div>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">優先度</span>
              <div className="flex items-center gap-2">
                <div className="w-32 bg-gray-100 rounded-full h-2">
                  <div className="bg-orange-400 h-2 rounded-full" style={{ width: '25%' }} />
                </div>
                <span className="text-gray-400 text-xs w-8">25%</span>
              </div>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">放置度</span>
              <div className="flex items-center gap-2">
                <div className="w-32 bg-gray-100 rounded-full h-2">
                  <div className="bg-purple-400 h-2 rounded-full" style={{ width: '20%' }} />
                </div>
                <span className="text-gray-400 text-xs w-8">20%</span>
              </div>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">工数ペナルティ</span>
              <div className="flex items-center gap-2">
                <div className="w-32 bg-gray-100 rounded-full h-2">
                  <div className="bg-blue-400 h-2 rounded-full" style={{ width: '10%' }} />
                </div>
                <span className="text-gray-400 text-xs w-8">10%</span>
              </div>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">マイルストーン近接</span>
              <div className="flex items-center gap-2">
                <div className="w-32 bg-gray-100 rounded-full h-2">
                  <div className="bg-green-400 h-2 rounded-full" style={{ width: '10%' }} />
                </div>
                <span className="text-gray-400 text-xs w-8">10%</span>
              </div>
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-4">
            ※ 放置度: 課題作成日からの経過日数が長いほどスコアが上がります
          </p>

          <div className="mt-6 pt-6 border-t border-gray-100">
            <h3 className="text-base font-semibold text-gray-700 mb-3">緊急度ラベル</h3>
            <p className="text-sm text-gray-500 mb-4">
              スコアは下記 5 段階のラベルでカードに表示されます。「上から順にやれば OK」という目安です。
            </p>
            <div className="space-y-2">
              <div className="flex items-center gap-3 text-sm">
                <span className="text-xs px-2 py-0.5 rounded-full bg-red-50 text-red-700 w-32 text-center">🔥 今すぐ着手</span>
                <span className="text-gray-500">スコア 1.0 以上 — 期限・優先度ともに高い</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <span className="text-xs px-2 py-0.5 rounded-full bg-orange-50 text-orange-700 w-32 text-center">⚡ これからやろう</span>
                <span className="text-gray-500">スコア 0.7 〜 1.0 — おすすめの次のタスク</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 w-32 text-center">📅 計画的に</span>
                <span className="text-gray-500">スコア 0.4 〜 0.7 — 順次対応で OK</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <span className="text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-700 w-32 text-center">🌱 余裕あり</span>
                <span className="text-gray-500">スコア 0.2 〜 0.4 — 後回しでも問題なし</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 w-32 text-center">☕ いつでも</span>
                <span className="text-gray-500">スコア 0.2 未満 — 急ぎではない</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* デイリーフォーカス */}
      <section className="mb-10">
        <h2 className="text-lg font-semibold text-gray-700 mb-3 flex items-center gap-2">
          <span className="bg-amber-100 text-amber-600 rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">★</span>
          デイリーフォーカス
        </h2>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm text-gray-600 mb-3 flex items-center gap-1.5">
            <Star size={14} className="text-amber-500" />
            「今日やる 3 つ」をピン留めして、一日の意思決定を支援します
          </p>
          <ul className="text-sm text-gray-600 space-y-2">
            <li>・初回: <strong>「おすすめ 3 件を採用」</strong>でスコア上位 3 件をワンクリック設定</li>
            <li>・各タスクカード右上の <strong>★ ボタン</strong>でピン留め / 解除</li>
            <li>・フォーカスカードの <strong>「✓ 完了」</strong>でその場で完了マーク</li>
            <li>・日付が変わると翌日のフォーカスは自動でリセット</li>
          </ul>
        </div>
      </section>

      {/* クイックジャンプ */}
      <section className="mb-10">
        <h2 className="text-lg font-semibold text-gray-700 mb-3 flex items-center gap-2">
          <span className="bg-blue-100 text-blue-600 rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">⌘</span>
          クイックジャンプ
        </h2>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm text-gray-600 mb-3 flex items-center gap-1.5">
            <Search size={14} className="text-blue-500" />
            <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-gray-100 border border-gray-200 rounded">⌘K</kbd>
            <span>でいつでも検索バーを開けます</span>
          </p>
          <ul className="text-sm text-gray-600 space-y-2">
            <li>・タイトル / IssueKey / メモ本文を横断検索</li>
            <li>・<kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-gray-100 border border-gray-200 rounded">↑↓</kbd> でカーソル移動、<kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-gray-100 border border-gray-200 rounded">↵</kbd> で詳細遷移</li>
            <li>・<kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-gray-100 border border-gray-200 rounded">Esc</kbd> で閉じる</li>
            <li>・ヘッダー右上の<strong>「検索」</strong>ボタンからも開けます</li>
          </ul>
        </div>
      </section>

      {/* 集中モード */}
      <section className="mb-10">
        <h2 className="text-lg font-semibold text-gray-700 mb-3 flex items-center gap-2">
          <span className="bg-orange-100 text-orange-600 rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">🍅</span>
          集中モード（ポモドーロ）
        </h2>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm text-gray-600 mb-3">
            タスクに集中する時間を作り、作業時間を自動でローカルメモに記録します。
          </p>
          <ul className="text-sm text-gray-600 space-y-2">
            <li>・タスク詳細ページの<strong>「🍅 集中する」</strong>ボタンで開始</li>
            <li>・15 / 25 / 45 / 60 分のプリセット選択可</li>
            <li>・タイマー終了時にデスクトップ通知</li>
            <li>・完了 / 中断時に作業時間をメモへ自動追記</li>
            <li>・他のタブやアプリ最小化中も継続</li>
          </ul>
        </div>
      </section>

      {/* 通知設定 */}
      <section className="mb-10">
        <h2 className="text-lg font-semibold text-gray-700 mb-3 flex items-center gap-2">
          <span className="bg-rose-100 text-rose-600 rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">!</span>
          通知 / アラート
        </h2>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm text-gray-600 mb-3 flex items-center gap-1.5">
            <Bell size={14} className="text-rose-500" />
            アプリを閉じていてもメニューバー常駐でデスクトップ通知が届きます
          </p>
          <ul className="text-sm text-gray-600 space-y-2">
            <li>・<strong>期限当日リマインド</strong>: 期限が今日のタスクを通知</li>
            <li>・<strong>期限切れリマインド</strong>: 期限を過ぎているタスクを通知</li>
            <li>・<strong>朝のサマリ</strong>: 設定時刻（既定 9:00）に「今日 N 件 / 期限切れ M 件」を 1 通知</li>
            <li>・通知をクリックすると該当タスクの詳細ページへ遷移</li>
            <li>・設定画面の<strong>「通知」</strong>セクションで個別 ON/OFF と時刻調整</li>
          </ul>
        </div>
      </section>
    </div>
  )
}

export default Guide
