import { useEffect, useState } from 'react'

// アプリ起動中だけ保持したい UI 状態（タブ選択など）を sessionStorage に逃がすためのフック。
// localStorage と違いブラウザ/Window を閉じれば消えるので、デフォルトに戻したい場面で都合がよい。
export function useSessionState<T>(key: string, initial: T): [T, (next: T | ((prev: T) => T)) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = sessionStorage.getItem(key)
      if (raw === null) return initial
      return JSON.parse(raw) as T
    } catch {
      return initial
    }
  })

  useEffect(() => {
    try {
      sessionStorage.setItem(key, JSON.stringify(value))
    } catch {
      // sessionStorage が利用不可な環境でも壊さない
    }
  }, [key, value])

  return [value, setValue]
}
