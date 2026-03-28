import { Settings, Globe, Key, FolderKanban, User, Building2, RefreshCw, MessageSquare, BarChart3, Calendar, List } from 'lucide-react'

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
        </div>
      </section>
    </div>
  )
}

export default Guide
