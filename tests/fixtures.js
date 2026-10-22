import { vi } from 'vitest'

export const makeHabit = (partial = {}) => ({
  id: 'real-habit', name: 'My existing habit', description: 'Keep this',
  frequency: 'daily', customDays: [], isDailyHabit: true, targetDays: null,
  habitColor: '#38bdf8', useGlobalGamification: false,
  customPoints: 10, customStreakBonuses: { 3: 2, 7: 5, 30: 10 },
  goalType: 'binary', goalTarget: null,
  history: { '2020-01-01': true, '2020-01-02': false },
  dailyValueHistory: {}, freezeDates: { '2020-01-03': true },
  createdAt: '2020-01-01', previousStreak: 0, streakMilestones: {},
  extraHabitField: { preserved: true }, ...partial,
})

export const makeState = (partial = {}) => ({
  schemaVersion: 6, habits: [makeHabit()],
  rewards: [{ id: 'deleted-reward', name: 'Old reward', requiredPoints: 80, deleted: true }],
  settings: { dailyBonus: 20, gamificationEnabled: true, quoteCategory: 'general',
    theme: 'light', globalStreakBonuses: { 3: 5, 7: 10, 30: 20 }, extraSetting: 'keep' },
  customQuotes: ['My own quote'],
  claimedRewards: [{ rewardId: 'deleted-reward', claimedAt: '2020-01-01', cost: 50, name: 'Original name' }],
  earnedBadges: [{ id: 'old-badge', habitId: 'real-habit', earnedAt: '2020-01-01' }],
  manualAdjustment: -7, streakFreezes: 2,
  extraStateField: { preserved: [1, 2, 3] }, ...partial,
})

export const memoryStorage = (entries = {}) => {
  const records = new Map(Object.entries(structuredClone(entries)))
  return {
    records,
    config: vi.fn(),
    getItem: vi.fn(async (key) => structuredClone(records.get(key) ?? null)),
    setItem: vi.fn(async (key, value) => {
      records.set(key, structuredClone(value))
      return value
    }),
  }
}

export const deferred = () => {
  let resolve, reject
  const promise = new Promise((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}
