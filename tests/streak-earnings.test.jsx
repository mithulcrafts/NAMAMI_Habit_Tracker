import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import localforage from 'localforage'
import { AppProvider, useApp } from '../src/context/AppContext'
import { legacyStats } from '../src/utils/legacyScoring'
import { makeHabit, makeState, memoryStorage } from './fixtures'
vi.mock('../src/utils/editingSession', () => ({ openEditingSession: async storage => ({
  save: state => storage.setItem('namami-state-v1', state), renew: async () => {}, release: async () => {},
}) }))
vi.mock('localforage', () => ({ default: { config: vi.fn(), getItem: vi.fn(), setItem: vi.fn() } }))
const KEY = 'namami-state-v1'
let storage
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 9, 23, 12))
  const state = makeState({ habits: [makeHabit({ createdAt: '2026-10-01', history: {}, freezeDates: {} })],
    claimedRewards: [], earnedBadges: [], manualAdjustment: 0 })
  storage = memoryStorage({ [KEY]: state })
  Object.assign(localforage, storage)
})
afterEach(async () => {
  // Let the provider's ordered writes finish before the next test replaces
  // the mocked storage implementation.
  await act(async () => {})
  vi.useRealTimers()
})
const mount = async () => {
  const app = renderHook(useApp, { wrapper: ({ children }) => <AppProvider>{children}</AppProvider> })
  await waitFor(() => expect(app.result.current.loading).toBe(false))
  await act(async () => {})
  return app
}
const log = (app, date, done = true) => act(() => app.result.current.toggleCompletion('real-habit', date, done))
const journal = () => storage.records.get(KEY).streakEarnings

it('L11: pays a milestone once, retains it after a break, and retains it on reload', async () => {
  const app = await mount()
  for (const date of ['2026-10-21', '2026-10-22', '2026-10-23']) log(app, date)
  expect(app.result.current.lifetimePoints).toBe(97) // 30 base + 60 daily + 2 habit + 5 global.
  vi.setSystemTime(new Date(2026, 9, 25, 12))
  act(() => window.dispatchEvent(new Event('focus')))
  expect(app.result.current.habits[0].streak).toBe(0)
  expect(app.result.current.lifetimePoints).toBe(97)
  await act(async () => {})
  expect(journal().awards).toHaveLength(2)
  app.unmount()
  const reopened = await mount()
  expect(reopened.result.current.lifetimePoints).toBe(97)
  expect(journal().awards).toHaveLength(2)
})
it('adds the full 7-step bonus to the earned 3-step bonus', async () => {
  const app = await mount()
  for (let day = 17; day <= 23; day++) log(app, `2026-10-${day}`)
  expect(app.result.current.lifetimePoints).toBe(232) // 210 + 2+5 habit + 5+10 global.
})
it('a new streak can earn again, but unchecking and rechecking cannot duplicate a payment', async () => {
  const app = await mount()
  for (const day of [15, 16, 17, 21, 22, 23]) log(app, `2026-10-${day}`)
  expect(app.result.current.lifetimePoints).toBe(194)
  log(app, '2026-10-23', false)
  expect(app.result.current.lifetimePoints).toBe(164) // The corrected log loses its 10+20, earned streak bonuses remain.
  log(app, '2026-10-23')
  expect(app.result.current.lifetimePoints).toBe(194)
  await act(async () => {})
  expect(journal().awards).toHaveLength(4)
})
it('changing bonus rates or turning scoring off cannot erase earned streak bonuses', async () => {
  const app = await mount()
  for (const day of [21, 22, 23]) log(app, `2026-10-${day}`)
  act(() => app.result.current.updateHabit('real-habit', { customStreakBonuses: { 3: 0, 7: 0, 30: 0 } }))
  act(() => app.result.current.updateSettings({ globalStreakBonuses: { 3: 0, 7: 0, 30: 0 } }))
  expect(app.result.current.lifetimePoints).toBe(97)
  act(() => app.result.current.updateSettings({ gamificationEnabled: false }))
  expect(app.result.current.lifetimePoints).toBe(7)
})
it.each(['daily', 'weekly', 'custom'])('upgrade preserves the released balance and exact raw data for %s schedules', async frequency => {
  const original = storage.records.get(KEY)
  original.habits[0] = makeHabit({ frequency, customDays: [1, 3, 5], history: {
    '2026-10-21': true, '2026-10-22': true, '2026-10-23': true }, freezeDates: {} })
  const oldPoints = legacyStats(original.habits, original.settings).points
  const app = await mount()
  expect(app.result.current.lifetimePoints).toBeGreaterThanOrEqual(oldPoints)
  expect(storage.records.get(KEY).habits[0].history).toEqual(original.habits[0].history)
  expect(storage.records.get(KEY).claimedRewards).toEqual(original.claimedRewards)
  const backups = [...storage.records.entries()].filter(([key]) => key.startsWith('namami-recovery:'))
  expect(backups).toHaveLength(1)
  expect(backups[0][1]).toEqual(original)
  const balance = app.result.current.lifetimePoints
  app.unmount()
  const reopened = await mount()
  expect(reopened.result.current.lifetimePoints).toBe(balance)
  expect([...storage.records.keys()].filter(key => key.startsWith('namami-recovery:'))).toHaveLength(1)
})
it('never replaces primary data if the pre-upgrade recovery write fails', async () => {
  const original = structuredClone(storage.records.get(KEY))
  storage.setItem.mockRejectedValueOnce(new Error('Disk full'))
  const app = renderHook(useApp, { wrapper: ({ children }) => <AppProvider>{children}</AppProvider> })
  await waitFor(() => expect(app.result.current.storageError?.kind).toBe('load'))
  expect(app.result.current.loading).toBe(true)
  expect(storage.records.get(KEY)).toEqual(original)
})

it('backfilling the start of the same run cannot pay its 3-step bonus a second time', async () => {
  const app = await mount()
  for (const day of [21, 22, 23]) log(app, '2026-10-' + day)
  log(app, '2026-10-20')
  expect(app.result.current.lifetimePoints).toBe(127) // Only the added day's 10+20.
  await act(async () => {})
  expect(journal().awards).toHaveLength(2)
})
