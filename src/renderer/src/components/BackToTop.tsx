import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { ArrowUp } from 'lucide-react'
import { useFocusTimer } from '../hooks/useFocusTimer'

const SHOW_THRESHOLD_PX = 240

// 画面を一定スクロールしたら右下にフローティング表示し、クリックで先頭へ戻る。
// MiniTimer が表示されているときは重ならないように上にずらす。
export default function BackToTop(): JSX.Element | null {
  const [visible, setVisible] = useState(false)
  const focus = useFocusTimer()
  const location = useLocation()

  useEffect(() => {
    const onScroll = (): void => {
      setVisible(window.scrollY > SHOW_THRESHOLD_PX)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  if (!visible) return null

  // MiniTimer が見える条件: focus.session があり、かつ /focus/:taskId ページにいない
  const miniTimerVisible =
    focus.session !== null && location.pathname !== `/focus/${focus.session.taskId}`

  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      className={`fixed right-6 w-10 h-10 rounded-full bg-white border border-gray-200 shadow-md hover:shadow-lg hover:bg-gray-50 flex items-center justify-center text-gray-600 transition-all z-40 ${
        miniTimerVisible ? 'bottom-28' : 'bottom-6'
      }`}
      title="トップに戻る"
      aria-label="トップに戻る"
    >
      <ArrowUp size={18} />
    </button>
  )
}
