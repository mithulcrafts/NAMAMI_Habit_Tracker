import { todayKey } from './date'
import { getHabitPeriods } from './schedule'
import { milestoneEvents, coverageFor, freshMilestones } from './streakEarnings'

export const getBadgeEvents = (habit, today = todayKey()) =>
  milestoneEvents(getHabitPeriods(habit, today), habit.id, {}, true)

export const getFreshBadgeEvents = (habit, today = todayKey()) => {
  const events = getBadgeEvents(habit, today)
  const seen = habit.streakMilestones?.badgePeriods || []
  const covered = habit.streakMilestones?.badgeCoverage ?? events.filter(event => seen.includes(event.id)).flatMap(coverageFor)
  return freshMilestones(events, seen, covered)
}

export const initializeBadgeTracking = (state, today = todayKey()) => {
  let changed = false
  const habits = state.habits.map(habit => {
    if (Array.isArray(habit.streakMilestones?.badgePeriods) && Array.isArray(habit.streakMilestones?.badgeCoverage)) return habit
    changed = true
    // Existing badge records stay intact; historical milestones are not
    // replayed as newly earned rewards during an upgrade.
    return { ...habit, streakMilestones: { ...habit.streakMilestones,
      badgePeriods: getBadgeEvents(habit, today).map(event => event.id),
      badgeCoverage: getBadgeEvents(habit, today).flatMap(coverageFor) } }
  })
  return changed ? { ...state, habits } : state
}
