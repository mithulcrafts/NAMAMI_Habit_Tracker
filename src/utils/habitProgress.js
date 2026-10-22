// The saved boolean records the outcome under the goal used for that log.
// Editing a habit's current goal must not reinterpret earlier completed days.
export const isHabitCompletedOnDate = (habit, dateKey) => {
  const recorded = habit.history?.[dateKey]
  if (typeof recorded === 'boolean') return recorded
  if (habit.goalType === 'binary') return false
  // Compatibility for numeric records that predate an accompanying boolean.
  const value = habit.dailyValueHistory?.[dateKey]
  return Number.isFinite(value) && value >= (habit.goalTarget || 1)
}

export const getRecordedDates = habit => [...new Set([
  ...Object.keys(habit.history || {}), ...Object.keys(habit.dailyValueHistory || {}),
])]
