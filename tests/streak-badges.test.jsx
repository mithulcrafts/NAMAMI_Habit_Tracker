import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import localforage from 'localforage'
import { AppProvider, useApp } from '../src/context/AppContext'
import { makeHabit, makeState, memoryStorage } from './fixtures'
vi.mock('../src/utils/editingSession', () => ({ openEditingSession: async storage => ({
  save: state => storage.setItem('namami-state-v1', state), renew: async () => {}, release: async () => {},
}) }))
vi.mock('localforage', () => ({ default: { config: vi.fn(), getItem: vi.fn(), setItem: vi.fn() } }))
let storage
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 9, 23, 12))
  storage = memoryStorage({ 'namami-state-v1': makeState({ habits: [makeHabit({ createdAt: '2026-10-01', history: {}, freezeDates: {} })], earnedBadges: [] }) })
  Object.assign(localforage, storage)
})
afterEach(async () => { await act(async () => {}); vi.useRealTimers() })
const mount = async () => {
  const app = renderHook(useApp, { wrapper: ({ children }) => <AppProvider>{children}</AppProvider> })
  await waitFor(() => expect(app.result.current.loading).toBe(false))
  return app
}
it('L08: awards the same milestone in two separate runs, with no duplicate on recheck or reload', async () => {
  const app = await mount()
  for (const day of [15, 16, 17, 21, 22, 23]) act(() => app.result.current.toggleCompletion('real-habit', `2026-10-${day}`, true))
  const badges = app.result.current.earnedBadges.filter(b => b.badgeId === 'streak-3')
  expect(badges).toHaveLength(2)
  expect(new Set(badges.map(b => b.id)).size).toBe(2)
  act(() => app.result.current.toggleCompletion('real-habit', '2026-10-23', false))
  act(() => app.result.current.toggleCompletion('real-habit', '2026-10-23', true))
  expect(app.result.current.earnedBadges.filter(b => b.badgeId === 'streak-3')).toHaveLength(2)
  await act(async () => {})
  app.unmount()
  const reopened = await mount()
  expect(reopened.result.current.earnedBadges.filter(b => b.badgeId === 'streak-3')).toEqual(badges)
})
it('retains existing repeat-every-3 badge behavior within a continuous run', async () => {
  const app = await mount()
  for (let day = 17; day <= 23; day++) act(() => app.result.current.toggleCompletion('real-habit', `2026-10-${day}`, true))
  expect(app.result.current.earnedBadges.filter(b => b.badgeId === 'streak-3')).toHaveLength(2)
  expect(app.result.current.earnedBadges.filter(b => b.badgeId === 'streak-7')).toHaveLength(1)
})
it('preserves old badge records and milestone metadata without replaying historical awards', async () => {
  const state = storage.records.get('namami-state-v1')
  state.habits[0].history = { '2026-10-21': true, '2026-10-22': true, '2026-10-23': true }
  state.habits[0].previousStreak = 3
  state.habits[0].streakMilestones = { unrelated: { keep: true } }
  const old = { id: 'real-habit-streak-3-1', badgeId: 'streak-3', habitId: 'real-habit', earnedAt: '2026-10-23', extra: 'keep' }
  state.earnedBadges = [old]
  const app = await mount()
  expect(app.result.current.earnedBadges.filter(b => b.badgeId === 'streak-3')).toEqual([old])
  expect(app.result.current.habits[0].streakMilestones.unrelated).toEqual({ keep: true })
})
