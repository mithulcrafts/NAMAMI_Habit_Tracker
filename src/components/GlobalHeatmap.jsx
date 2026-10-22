import CalendarHeatmap from 'react-calendar-heatmap'
import { getRecordedDates, isHabitCompletedOnDate } from '../utils/habitProgress'
import 'react-calendar-heatmap/dist/styles.css'

export const GlobalHeatmap = ({ habits }) => {
  const endDate = new Date()
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - 120)

  // Convert dates to YYYY-MM-DD string format
  const formatDateString = (d) => {
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const endDateStr = formatDateString(endDate)
  const startDateStr = formatDateString(startDate)

  // Aggregate all habits per date
  const aggregated = {}
  habits.forEach((habit) => {
    getRecordedDates(habit).forEach(date => {
      if (isHabitCompletedOnDate(habit, date)) aggregated[date] = (aggregated[date] || 0) + 1
    })
  })

  const values = Object.entries(aggregated).map(([date, count]) => ({
    date,
    count: Math.min(count, habits.length),
  }))

  // Get theme-aware colors
  const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
  const colors = isDark 
    ? {
        c1: { fill: '#00F5FF', shadow: '#00F5FF', opacity: 0.35 },
        c2: { fill: '#00F5FF', shadow: '#00F5FF', opacity: 0.55 },
        c3: { fill: '#00F5FF', shadow: '#00F5FF', opacity: 0.8 },
        c4: { fill: '#00F5FF', shadow: '#00F5FF', opacity: 1 },
      }
    : {
        c1: { fill: '#bfdbfe', shadow: '#3b82f6', opacity: 0.4 },
        c2: { fill: '#93c5fd', shadow: '#3b82f6', opacity: 0.6 },
        c3: { fill: '#60a5fa', shadow: '#3b82f6', opacity: 0.8 },
        c4: { fill: '#3b82f6', shadow: '#3b82f6', opacity: 1 },
      }

  const styleContent = `
    #global-heatmap .color-github-1 { fill: ${colors.c1.fill} !important; opacity: ${colors.c1.opacity} !important; filter: drop-shadow(0 0 4px ${colors.c1.shadow}) !important; }
    #global-heatmap .color-github-2 { fill: ${colors.c2.fill} !important; opacity: ${colors.c2.opacity} !important; filter: drop-shadow(0 0 6px ${colors.c2.shadow}) !important; }
    #global-heatmap .color-github-3 { fill: ${colors.c3.fill} !important; opacity: ${colors.c3.opacity} !important; filter: drop-shadow(0 0 8px ${colors.c3.shadow}) !important; }
    #global-heatmap .color-github-4 { fill: ${colors.c4.fill} !important; opacity: ${colors.c4.opacity} !important; filter: drop-shadow(0 0 10px ${colors.c4.shadow}) !important; }
  `

  return (
    <div className="glass rounded-xl p-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-bold uppercase tracking-wider text-white">OVERALL COMPLETION HEATMAP</h4>
        <span className="text-xs text-slate-400 font-medium">ALL HABITS AGGREGATED</span>
      </div>
      <div className="mt-2 overflow-x-auto">
        <style>{styleContent}</style>
        <div id="global-heatmap">
          <CalendarHeatmap
            startDate={startDateStr}
            endDate={endDateStr}
            values={values}
            classForValue={(val) => {
              if (!val || !val.count) return 'color-empty'
              
              // Scale intensity based on percentage of total habits completed
              const totalHabits = habits.length || 1
              const ratio = val.count / totalHabits
              
              if (ratio >= 0.75) return 'color-github-4' // 75%+ of habits
              if (ratio >= 0.5) return 'color-github-3' // 50-74% of habits
              if (ratio >= 0.25) return 'color-github-2' // 25-49% of habits
              if (ratio > 0) return 'color-github-1' // Some habits completed
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
