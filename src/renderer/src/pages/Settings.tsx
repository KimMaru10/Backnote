function Settings(): JSX.Element {
  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-800 mb-6">Settings</h2>

      {/* Space Registration Placeholder */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-700 mb-4">
          Backlog スペース管理
        </h3>
        <p className="text-gray-500 mb-4">
          Backlogスペースを追加して、タスクを取得できるようにします。
        </p>
        <button className="px-4 py-2 bg-[#FAC775] text-[#BA7517] rounded-lg font-medium hover:bg-[#f5bc5c] transition-colors">
          + スペースを追加
        </button>
      </div>
    </div>
  )
}

export default Settings
