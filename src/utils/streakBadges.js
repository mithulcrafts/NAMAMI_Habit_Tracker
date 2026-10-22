import { todayKey } from './date'
import { getHabitPeriods } from './schedule'
import { milestoneEvents } from './streakEarnings'

export const getBadgeEvents = (habit, today = todayKey()) =>
  milestoneEvents(getHabitPeriods(habit, today), habit.id, {}, true)

export const initializeBadgeTracking = (state, today = todayKey()) => {
  let changed = false
  const habits = state.habits.map(habit => {
    if (Array.isArray(habit.streakMilestones?.badgePeriods)) return habit
    changed = true
    // Existing badge records stay intact; historical milestones are not
    // replayed as newly earned rewards during an upgrade.
    return { ...habit, streakMilestones: { ...habit.streakMilestones,
      badgePeriods: getBadgeEvents(habit, today).map(event => event.id) } }
  })
  return changed ? { ...state, habits } : state
}
