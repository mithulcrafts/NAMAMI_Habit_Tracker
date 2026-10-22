import { todayKey } from './date'
import { getHabitPeriods, getGlobalPeriods } from './schedule'

// Stable IDs use the qualifying period, so toggling a check-in or reloading
// cannot pay the same milestone twice. A later run has different periods.
export const milestoneEvents = (periods, scope, bonuses, repeat = false) => {
  const events = []
  let streak = 0
  let run = []
  for (const period of periods) {
    streak = period.success ? streak + 1 : 0
    run = period.success ? [...run, period.key] : []
    for (const threshold of [3, 7, 30]) {
      if (streak && (repeat ? streak % threshold === 0 : streak === threshold)) {
        events.push({ id: JSON.stringify([scope, threshold, period.key]),
          scope, periods: run.slice(-threshold), threshold, date: period.key, amount: bonuses[threshold] ?? 0,
          milestone: Math.floor(streak / threshold) })
      }
    }
  }
  return events
}

export const coverageFor = event => event.periods.map(period => JSON.stringify([event.scope, event.threshold, period]))
export const freshMilestones = (events, seenIds, coveredPeriods) => {
  const seen = new Set(seenIds)
  const covered = new Set(coveredPeriods)
  const fresh = []
  for (const event of events) {
    if (seen.has(event.id) || coverageFor(event).some(key => covered.has(key))) continue
    fresh.push(event)
    coverageFor(event).forEach(key => covered.add(key))
  }
  return { fresh, covered: [...covered] }
}

export const getStreakEvents = (state, today = todayKey()) => [
  ...state.habits.flatMap(h => milestoneEvents(getHabitPeriods(h, today), h.id,
    h.customStreakBonuses ?? { 3: 2, 7: 5, 30: 10 })),
  ...milestoneEvents(getGlobalPeriods(state.habits, today), 'global',
    state.settings.globalStreakBonuses ?? { 3: 5, 7: 10, 30: 20 }),
]

export const initializeStreakEarnings = (state, opening, today = todayKey()) => {
  if (state.streakEarnings) return state
  if (!Number.isFinite(opening) || opening < 0) throw new Error('Saved scoring settings cannot be read safely. Your original data has been kept.')
  return { ...state, streakEarnings: { version: 1, opening, awards: [],
    seen: getStreakEvents(state, today).map(event => event.id),
    covered: getStreakEvents(state, today).flatMap(coverageFor), lastDay: today } }
}

export const reconcileStreakEarnings = (previous, next, today = todayKey()) => {
  const journal = previous.streakEarnings
  if (!journal) return next
  const seen = new Set(journal.seen)
  const newEvents = getStreakEvents(next, today).filter(event => !seen.has(event.id))
  if (!newEvents.length && journal.lastDay === today) return next
  // Configuration edits must not pay for old milestones again. Actual logging,
  // freezes, and the passing of a weekly deadline can earn new milestones.
  const activityChanged = next.habits.some(h => {
    const old = previous.habits.find(item => item.id === h.id)
    return old && (old.history !== h.history || old.dailyValueHistory !== h.dailyValueHistory || old.freezeDates !== h.freezeDates)
  })
  const priorCoverage = journal.covered ?? getStreakEvents(previous, today).filter(event => seen.has(event.id)).flatMap(coverageFor)
  const { fresh, covered } = freshMilestones(newEvents, journal.seen, priorCoverage)
  const canEarn = next.settings.gamificationEnabled && (activityChanged || journal.lastDay !== today)
  return { ...next, streakEarnings: { ...journal, lastDay: today, covered,
    seen: [...journal.seen, ...newEvents.map(event => event.id)],
    awards: [...journal.awards, ...fresh.filter(event => canEarn && Number.isFinite(event.amount) && event.amount >= 0)
      .map(event => ({ ...event, earnedAt: today }))],
  } }
}

export const earnedStreakPoints = journal => journal.opening + journal.awards.reduce((sum, award) => sum + award.amount, 0)
