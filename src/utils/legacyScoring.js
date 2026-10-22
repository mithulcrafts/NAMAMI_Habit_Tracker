// Exact released calculation, used ONLY to protect the opening balance on upgrade.
import { formatDate, todayKey } from './date'

export const legacyStats = (habits, settings) => {
  const isHabitCompletedOnDate = (habit, dateKey) => {
    if (habit.goalType === 'binary') {
      return habit.history?.[dateKey] === true
    }
    const value = habit.dailyValueHistory?.[dateKey] ?? 0
    return value >= (habit.goalTarget || 1)
  }

  const enriched = habits.map((habit) => {
    // Compute streak: include today if completed/frozen; otherwise show streak up to yesterday
    let streak = 0
    let cursor = new Date()
    cursor.setHours(0, 0, 0, 0)
    const today = todayKey()
    
    while (true) {
      const key = formatDate(cursor)
      const isFrozen = habit.freezeDates?.[key] === true
      if (isFrozen) {
        streak += 1
        cursor.setDate(cursor.getDate() - 1)
        continue
      }

      const dayEntry = habit.history?.[key]

      // If day exists and is explicitly false, break the streak
      if (dayEntry === false) {
        if (key === today) {
          cursor.setDate(cursor.getDate() - 1)
          continue
        }
        break
      }

      const isCompleted = isHabitCompletedOnDate(habit, key)
      if (isCompleted) {
        streak += 1
        cursor.setDate(cursor.getDate() - 1)
      } else {
        // If today is not yet completed, fall back to streak up to yesterday
        if (key === today) {
          cursor.setDate(cursor.getDate() - 1)
          continue
        }
        // Day not completed - stop counting
        break
      }
    }

    // Count total completions (days where target was met)
    const uniqueDateKeys = new Set([
      ...Object.keys(habit.history || {}),
      ...Object.keys(habit.dailyValueHistory || {}),
    ])
    const totalCompleted = Array.from(uniqueDateKeys).filter((dateKey) => isHabitCompletedOnDate(habit, dateKey)).length

    const completionRate =
      habit.isDailyHabit ? null : Math.min(100, Math.round((totalCompleted / (habit.targetDays || 1)) * 100))

    return { ...habit, streak, totalCompleted, completionRate }
  })

  // Collect all completed dates for bonuses (only when target is met)
  const completedDates = {}
  enriched.forEach((habit) => {
    const keys = new Set([
      ...Object.keys(habit.history || {}),
      ...Object.keys(habit.dailyValueHistory || {}),
    ])
    keys.forEach((dateKey) => {
      if (isHabitCompletedOnDate(habit, dateKey)) {
        completedDates[dateKey] = (completedDates[dateKey] || 0) + 1
      }
    })
  })

  const bonusDays = Object.entries(completedDates).filter(([, count]) => count >= enriched.length)

  const basePoints = settings.gamificationEnabled
    ? enriched.reduce((sum, habit) => {
        const pointsPerCompletion = habit.customPoints ?? 10
        return sum + habit.totalCompleted * pointsPerCompletion
      }, 0)
    : 0

  const dailyBonusPoints = settings.gamificationEnabled ? bonusDays.length * settings.dailyBonus : 0

  const perHabitStreakBonus = settings.gamificationEnabled
    ? enriched.reduce((sum, habit) => {
        const bonuses = habit.customStreakBonuses ?? { 3: 2, 7: 5, 30: 10 }
        if (habit.streak >= 30) return sum + (bonuses[30] || 0)
        if (habit.streak >= 7) return sum + (bonuses[7] || 0)
        if (habit.streak >= 3) return sum + (bonuses[3] || 0)
        return sum
      }, 0)
    : 0

  // Calculate global streak (consecutive days where ALL habits were completed)
  let globalStreak = 0
  if (settings.gamificationEnabled && enriched.length > 0) {
    let cursor = new Date()
    cursor.setHours(0, 0, 0, 0)
    const today = todayKey()
    while (true) {
      const key = formatDate(cursor)
      const allCompleted = enriched.every((habit) => {
        const isFrozen = habit.freezeDates?.[key] === true
        return isFrozen || isHabitCompletedOnDate(habit, key)
      })
      if (allCompleted) {
        globalStreak += 1
        cursor.setDate(cursor.getDate() - 1)
      } else if (key === today) {
        cursor.setDate(cursor.getDate() - 1)
      } else {
        break
      }
    }
  }

  const globalStreakBonus = settings.gamificationEnabled
    ? (() => {
        const bonuses = settings.globalStreakBonuses ?? { 3: 5, 7: 10, 30: 20 }
        if (globalStreak >= 30) return bonuses[30] || 0
        if (globalStreak >= 7) return bonuses[7] || 0
        if (globalStreak >= 3) return bonuses[3] || 0
        return 0
      })()
    : 0

  const totalPoints = basePoints + dailyBonusPoints + perHabitStreakBonus + globalStreakBonus

  return {
    habits: enriched,
    points: totalPoints,
    bonusDays: bonusDays.map(([dateKey]) => dateKey),
    globalStreak,
  }
}

