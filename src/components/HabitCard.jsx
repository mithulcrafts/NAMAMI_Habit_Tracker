import { useState } from 'react'
import { todayKey } from '../utils/date'

const getThemeClasses = () => {
  const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
  return {
    freezeBg: isDark ? 'bg-sky-500/15' : 'bg-blue-100/60',
    freezeText: isDark ? 'text-sky-200' : 'text-blue-700',
    freezeBorder: isDark ? 'border-sky-500/40' : 'border-blue-400/50',
    freezeTextLight: isDark ? 'text-sky-100' : 'text-blue-700',
    freezeButtonHover: isDark ? 'hover:border-sky-400/70' : 'hover:border-blue-400/70',
    freezeButtonBg: isDark ? 'bg-sky-500 hover:bg-sky-400' : 'bg-blue-500 hover:bg-blue-400',
  }
}

export const HabitCard = ({
  habit,
  selectedDateKey,
  isToday,
  selectedDateLabel,
  relativeLabel,
  onToggle,
  onOpen,
  onEdit,
  onDelete,
  streakFreezes = 0,
  onUseStreakFreeze,
  onRemoveStreakFreeze,
}) => {
  const today = todayKey()
  const [valueInput, setValueInput] = useState('')
  const theme = getThemeClasses()
  
  // Use selectedDateKey instead of today
  const dateKey = selectedDateKey || today
  const friendlyLabel = selectedDateLabel || dateKey
  const relative = relativeLabel || (isToday ? 'Today' : 'Selected date')
  const doneToday = habit.history?.[dateKey]
  const completion = Math.min(100, Math.round((habit.totalCompleted / habit.targetDays) * 100)) || 0
  
  // For count/duration, get the selected date's value
  const todayValue = habit.dailyValueHistory?.[dateKey] ?? null
  const goalMet = habit.goalType === 'binary' ? doneToday : (todayValue ?? 0) >= (habit.goalTarget || 1)
  const isFrozen = habit.freezeDates?.[dateKey] === true
  const isFuture = dateKey > today
  const canUseFreeze = Boolean(onUseStreakFreeze) && !isFuture && !goalMet && !isFrozen && streakFreezes > 0

  const handleSubmitValue = () => {
    if (valueInput === '' || isNaN(valueInput)) return
    const value = Number(valueInput)
    if (!Number.isFinite(value) || value < 0) {
      alert('Please enter a number of 0 or more.')
      return
    }
    onToggle(habit.id, dateKey, value >= (habit.goalTarget || 1), value)
    setValueInput('')
  }

  return (
    <div className="glass card-hover rounded-xl p-4 fade-in">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-widest text-brand-200">{habit.frequency}</p>
          <h3 className="break-words text-lg font-semibold text-white">{habit.name}</h3>
          <p className="break-words text-sm text-slate-300">{habit.description}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-300">
            <span className="rounded-full border border-white/10 bg-slate-900/60 px-2.5 py-1 font-semibold text-white">
              {friendlyLabel}
            </span>
            <span className="rounded-full bg-brand-500/20 px-2.5 py-1 font-semibold text-brand-50">{relative}</span>
            {!isToday && (
              <span className="rounded-full bg-amber-500/15 px-2 py-1 font-semibold text-amber-100">Editing past day</span>
            )}
          </div>
        </div>
        <div className="flex shrink-0 gap-2 self-start sm:self-auto">
          <button
            className="rounded-md border border-white/10 bg-slate-900/40 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-200 transition hover:border-brand-400/60 hover:text-brand-100 hover:bg-slate-900/60 whitespace-nowrap"
            onClick={() => onEdit(habit)}
          >
            Edit
          </button>
          <button
            className="rounded-md border border-white/10 bg-slate-900/40 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-200 transition hover:border-brand-400/60 hover:text-brand-100 hover:bg-slate-900/60 whitespace-nowrap"
            onClick={() => onDelete(habit.id)}
          >
            Delete
          </button>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-slate-300">
        <span className="rounded-full bg-brand-500/15 px-3 py-1 text-brand-100">Streak: {habit.streak}d</span>
        <span className="rounded-full bg-slate-800 px-3 py-1">Done: {habit.totalCompleted}</span>
        {!habit.isDailyHabit && (
          <span className="rounded-full bg-slate-800 px-3 py-1">Target: {habit.targetDays} days</span>
        )}
        {habit.goalType !== 'binary' && (
          <span className="rounded-full bg-slate-800 px-3 py-1">
            {habit.goalType === 'count' ? 'Count' : 'Duration'}: {habit.goalTarget}
          </span>
        )}
      </div>

      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full border border-white/5 bg-slate-900/70">
        <div
          className="h-full rounded-full bg-brand-500/90 transition-all duration-300"
          style={{ width: `${completion}%` }}
        />
      </div>

      <div className="mt-3 flex flex-col gap-2">
        {habit.goalType === 'binary' ? (
          <button
            onClick={() => onToggle(habit.id, dateKey, !doneToday)}
            className={`rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-soft transition ${
              doneToday ? 'bg-emerald-500 hover:bg-emerald-400' : 'bg-slate-800 hover:bg-slate-700'
            }`}
          >
            {doneToday ? (isToday ? 'Completed today' : 'Completed') : (isToday ? 'Mark done today' : 'Mark done')}
          </button>
        ) : (
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              type="number"
              min="0"
              placeholder={`Enter ${habit.goalType === 'count' ? 'count' : 'minutes'}`}
              value={valueInput}
              onChange={(e) => setValueInput(e.target.value)}
              className="flex-1 rounded-md border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-brand-400 focus:ring-brand-400"
            />
            <button
              onClick={handleSubmitValue}
              disabled={valueInput === ''}
              className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white shadow-soft hover:bg-brand-400 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
            >
              Log
            </button>
          </div>
        )}
        {habit.goalType !== 'binary' && todayValue !== null && (
          <div className={`rounded-md px-3 py-2 text-sm font-semibold ${
            goalMet ? 'bg-emerald-500/15 text-emerald-200' : 'bg-amber-500/15 text-amber-200'
          }`}>
            {todayValue} / {habit.goalTarget} {habit.goalType === 'count' ? 'completed' : 'minutes'}
            {goalMet && ' ✓ Goal met!'}
          </div>
        )}
        {isFrozen && (
          <div className={`rounded-md ${theme.freezeBg} px-3 py-2 text-sm font-semibold ${theme.freezeText}`}>
            Streak freeze used for this day
          </div>
        )}
        {isFrozen && (
          <button
            onClick={() => onRemoveStreakFreeze?.(habit.id, dateKey)}
            className={`rounded-lg border ${theme.freezeBorder} px-4 py-2 text-sm font-semibold ${theme.freezeTextLight} shadow-soft transition ${theme.freezeButtonHover}`}
          >
            Remove streak freeze
          </button>
        )}
        {!goalMet && !isFrozen && (
          <button
            onClick={() => onUseStreakFreeze?.(habit.id, dateKey)}
            disabled={!canUseFreeze}
            className={`rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-soft transition ${
              canUseFreeze ? theme.freezeButtonBg : 'bg-slate-800 text-slate-400'
            }`}
          >
            {streakFreezes > 0 ? 'Use streak freeze' : 'No streak freezes'}
          </button>
        )}
      </div>

      <div className="mt-3 flex items-center justify-end">
        <button
          onClick={() => onOpen(habit.id)}
          className="text-sm font-semibold text-brand-200 hover:text-brand-100"
        >
          View detail →
        </button>
      </div>
    </div>
  )
}
