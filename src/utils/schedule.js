import { formatDate, startOfWeek, todayKey } from './date'
import { getRecordedDates, isHabitCompletedOnDate } from './habitProgress'

export const localDate = key => new Date(`${key}T00:00:00`)
export const shiftDate = (key, days) => {
  const date = localDate(key)
  date.setDate(date.getDate() + days)
  return formatDate(date)
}
const validDate = key => /^\d{4}-\d{2}-\d{2}$/.test(key) && Number.isFinite(localDate(key).getTime())
export const habitStart = (habit, today = todayKey()) =>
  [habit.createdAt, ...getRecordedDates(habit), ...Object.keys(habit.freezeDates || {})]
    .filter(key => typeof key === 'string' && validDate(key) && key <= today).sort()[0] ?? today

export const isScheduledDay = (habit, key) => habit.frequency !== 'custom' ||
  (habit.customDays || []).includes(localDate(key).getDay())

export const habitPeriod = (habit, key) => {
  const start = habit.frequency === 'weekly' ? startOfWeek(key) : key
  const end = habit.frequency === 'weekly' ? shiftDate(start, 6) : key
  let completed = false, frozen = false
  for (let day = start; day <= end; day = shiftDate(day, 1)) {
    completed ||= isHabitCompletedOnDate(habit, day)
    frozen ||= habit.freezeDates?.[day] === true
  }
  return { key: start, end, completed, frozen, success: completed || frozen }
}

export const getHabitPeriods = (habit, today = todayKey()) => {
  const periods = []
  const start = habitStart(habit, today)
  let key = habit.frequency === 'weekly' ? startOfWeek(start) : start
  for (; key <= today; key = shiftDate(key, habit.frequency === 'weekly' ? 7 : 1)) {
    if (isScheduledDay(habit, key)) periods.push(habitPeriod(habit, key))
  }
  return periods
}

export const currentStreak = (periods, today = todayKey()) => {
  let streak = 0
  for (let i = periods.length - 1; i >= 0; i--) {
    const period = periods[i]
    if (period.success) streak++
    else if (period.end < today) break
  }
  return streak
}

// A weekly task is due at the end of its calendar week. Finishing it earlier
// satisfies that deadline; the other six days do not require six repetitions.
export const getGlobalPeriods = (habits, today = todayKey()) => {
  if (!habits.length) return []
  const starts = new Map(habits.map(h => [h.id, habitStart(h, today)]))
  const first = [...starts.values()].sort()[0]
  const periods = []
  for (let key = first; key <= today; key = shiftDate(key, 1)) {
    const due = habits.filter(h => starts.get(h.id) <= key && isScheduledDay(h, key) &&
      (h.frequency !== 'weekly' || localDate(key).getDay() === 6))
    if (!due.length) continue
    const entries = due.map(h => habitPeriod(h, key))
    periods.push({ key, end: key, completed: entries.every(p => p.completed),
      success: entries.every(p => p.success), habitIds: due.map(h => h.id) })
  }
  return periods
}
