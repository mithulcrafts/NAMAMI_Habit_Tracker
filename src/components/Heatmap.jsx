import CalendarHeatmap from 'react-calendar-heatmap'
import { isHabitCompletedOnDate } from '../utils/habitProgress'
import 'react-calendar-heatmap/dist/styles.css'

export const Heatmap = ({ history, habitColor, habitName, goalType, goalTarget, dailyValueHistory, freezeDates }) => {
  const patternId = `freeze-${habitColor?.slice(1) || 'default'}`
  const endDate = new Date()
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - 120)

  const formatDateString = (d) => {
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const endDateStr = formatDateString(endDate)
  const startDateStr = formatDateString(startDate)

  // Build values for the entire date range to reflect partial progress
  const values = (() => {
    const vals = []
    const cursor = new Date(startDate)
    const end = new Date(endDate)
    while (cursor <= end) {
      const key = formatDateString(cursor)
      const frozen = (freezeDates || {})[key] === true
      const done = isHabitCompletedOnDate({ history, goalType, goalTarget, dailyValueHistory }, key)
      const count = goalType === 'binary' ? (done ? 1 : 0) : (dailyValueHistory?.[key] ?? 0)
      vals.push({ date: key, count, done, frozen })
      cursor.setDate(cursor.getDate() - -1) // increment by 1 day
    }
    return vals
  })()

  return (
    <div className="glass rounded-xl p-4">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-bold uppercase tracking-wider text-white">COMPLETION HEATMAP</h4>
          {habitName && <p className="text-xs text-slate-400">{habitName}</p>}
          {goalType !== 'binary' && (
            <p className="text-xs text-slate-500">TARGET: {goalTarget} {goalType === 'count' ? 'ITEMS' : 'MIN'}</p>
          )}
        </div>
        <span className="text-xs text-slate-400 font-medium">LAST 4 MONTHS</span>
      </div>
      <div className="mt-2 overflow-x-auto">
        <style>{`
          #heatmap-${habitColor?.slice(1)} .color-github-1 { fill: ${habitColor} !important; opacity: 0.35 !important; filter: drop-shadow(0 0 4px ${habitColor}) !important; }
          #heatmap-${habitColor?.slice(1)} .color-github-2 { fill: ${habitColor} !important; opacity: 0.55 !important; filter: drop-shadow(0 0 6px ${habitColor}) !important; }
          #heatmap-${habitColor?.slice(1)} .color-github-3 { fill: ${habitColor} !important; opacity: 0.8 !important; filter: drop-shadow(0 0 8px ${habitColor}) !important; }
          #heatmap-${habitColor?.slice(1)} .color-github-4 { fill: ${habitColor} !important; opacity: 1 !important; filter: drop-shadow(0 0 10px ${habitColor}) !important; }
          #heatmap-${habitColor?.slice(1)} .color-freeze { fill: url(#${patternId}) !important; opacity: 1 !important; filter: drop-shadow(0 0 6px rgba(255, 255, 255, 0.3)) !important; }
        `}</style>
        <div id={`heatmap-${habitColor?.slice(1)}`} className={`heatmap-${habitColor?.slice(1)}`}>
          <svg width="0" height="0" aria-hidden="true" focusable="false">
            <defs>
              <pattern id={patternId} patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)">
                <rect width="6" height="6" fill={habitColor || '#00F5FF'} />
                <rect width="2" height="6" fill="rgba(255,255,255,0.45)" />
              </pattern>
            </defs>
          </svg>
          <CalendarHeatmap
            startDate={startDateStr}
            endDate={endDateStr}
            values={values}
            classForValue={(val) => {
              if (!val) return 'color-empty'
              if (val.frozen) return 'color-freeze'
              if (val.done) return 'color-github-4'
              if (!val.count) return 'color-empty'
              
              // For binary habits, just show full intensity
              if (goalType === 'binary') return 'color-github-4'
              
              // For numeric goals, scale intensity based on count
              const target = goalTarget || 1
              const ratio = val.count / target
              
              // Only a recorded completion receives full intensity. A lower
              // current target must not turn old partial progress into a success.
              if (ratio >= 0.75) return 'color-github-3' // 75% of goal
              if (ratio >= 0.5) return 'color-github-2' // 50% of goal
              if (ratio > 0) return 'color-github-1' // Some activity
              return 'color-empty'
            }}
            gutterSize={2}
            showWeekdayLabels
          />
        </div>
      </div>
    </div>
  )
}
