import { Heatmap } from '../components/Heatmap'
import { ProgressCharts } from '../components/ProgressCharts'
import { Badges } from '../components/Badges'
import { HabitGamificationPanel } from '../components/HabitGamificationPanel'
import { formatDate, todayKey } from '../utils/date'
import { getRecordedDates, isHabitCompletedOnDate } from '../utils/habitProgress'

export const HabitDetail = ({
  habit,
  points,
  earnedBadges,
  onClose,
  onUpdateHabitGamification,
}) => {
  if (!habit) return null
  
  const completionRate = habit.isDailyHabit ? habit.streak * 10 : Math.min(100, Math.round((habit.totalCompleted / habit.targetDays) * 100)) || 0
  const lastCheck = getRecordedDates(habit)
    .filter(d => isHabitCompletedOnDate(habit, d))
    .sort()
    .pop()

  return (
    <div className="rounded-2xl glass p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-brand-100">HABIT DETAIL</p>
          <h2 className="text-2xl font-bold uppercase tracking-wider text-white">{habit.name}</h2>
          <p className="text-sm text-slate-400">{habit.description}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: habit.habitColor }} />
            <span className="text-xs text-slate-400">
              {habit.isDailyHabit ? 'Daily habit' : `Target-based (${habit.targetDays} days)`}
            </span>
            <span className="text-xs text-slate-500">·</span>
            <span className="text-xs text-slate-400">
              {habit.goalType === 'binary' && 'Binary (done/missed)'}
              {habit.goalType === 'count' && `Count-based (target: ${habit.goalTarget})`}
              {habit.goalType === 'duration' && `Duration-based (target: ${habit.goalTarget} min)`}
            </span>
          </div>
        </div>
        <button
          onClick={onClose}
          className="rounded-md border border-white/10 px-3 py-1 text-sm font-medium uppercase text-slate-300 hover:border-white/30"
        >
          Close
        </button>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="glass rounded-xl p-3">
          <p className="text-xs uppercase tracking-widest text-brand-100">STREAK</p>
          <p className="text-2xl font-bold text-white">{habit.streak} days</p>
        </div>
        <div className="glass rounded-xl p-3">
          <p className="text-xs uppercase tracking-widest text-brand-100">TOTAL COMPLETED</p>
          <p className="text-2xl font-bold text-white">{habit.totalCompleted}</p>
        </div>
        <div className="glass rounded-xl p-3">
          <p className="text-xs uppercase tracking-widest text-brand-100">PROGRESS</p>
          <p className="text-2xl font-bold text-white">{completionRate}%</p>
        </div>
      </div>

      <div className="mt-3 glass rounded-xl p-4">
        <div className="flex items-center justify-between text-sm text-slate-400">
          <span>
            {habit.isDailyHabit ? 'ONGOING DAILY HABIT' : `TARGET: ${habit.targetDays} DAYS`} · FREQUENCY:{' '}
            {habit.frequency.toUpperCase()}
          </span>
          <span>LAST DONE: {lastCheck ? formatDate(lastCheck) : '—'}</span>
        </div>
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-800">
          <div
            className="h-full rounded-full bg-gradient-to-r from-brand-400 to-accent"
            style={{ width: `${completionRate}%` }}
          />
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Heatmap 
          history={habit.history} 
          habitColor={habit.habitColor} 
          habitName={habit.name}
          goalType={habit.goalType}
          goalTarget={habit.goalTarget}
          dailyValueHistory={habit.dailyValueHistory}
          freezeDates={habit.freezeDates}
        />
        <ProgressCharts history={habit.history} />
      </div>

      <div className="mt-4">
        <HabitGamificationPanel
          habit={habit}
          onUpdate={onUpdateHabitGamification}
        />
      </div>

      <div className="mt-4">
        <Badges maxStreak={habit.streak} points={points} earnedBadges={earnedBadges} habitId={habit.id} />
      </div>

      <div id="widget" className="mt-4 glass rounded-xl p-3">
        <p className="text-sm font-bold uppercase tracking-wider text-white">TODAY</p>
        <p className="text-sm text-slate-400">{todayKey()}</p>
      </div>
    </div>
  )
}
