function Dashboard(): JSX.Element {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Dashboard</h2>
        <button className="px-4 py-2 bg-[#FAC775] text-[#BA7517] rounded-lg font-medium hover:bg-[#f5bc5c] transition-colors">
          Sync
        </button>
      </div>

      {/* Placeholder */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
        <div className="w-16 h-16 bg-[#FAC775] rounded-2xl flex items-center justify-center mx-auto mb-4">
          <span className="text-[#BA7517] font-bold text-2xl">P</span>
        </div>
        <h3 className="text-lg font-semibold text-gray-700 mb-2">
          Welcome to PeelTask
        </h3>
        <p className="text-gray-500">
          Backlogスペースを登録して、タスクの同期を始めましょう。
        </p>
      </div>
    </div>
  )
}

export default Dashboard
