import { useEffect, useState } from 'react'
import { todayKey } from '../utils/date'

// Re-read the local day after midnight, clock changes, and mobile suspension.
export const useToday = () => {
  const [today, setToday] = useState(todayKey)
  useEffect(() => {
    let timer
    const refresh = () => {
      clearTimeout(timer)
      setToday(todayKey())
      const now = new Date()
      const midnight = new Date(now)
      midnight.setHours(24, 0, 0, 0)
      timer = setTimeout(refresh, Math.min(60000, midnight - now + 10))
    }
    refresh()
    window.addEventListener('focus', refresh)
    window.addEventListener('pageshow', refresh)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('focus', refresh)
      window.removeEventListener('pageshow', refresh)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [])
  return today
}
