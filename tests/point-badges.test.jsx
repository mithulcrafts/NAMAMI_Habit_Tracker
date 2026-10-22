import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import localforage from 'localforage'
import { AppProvider, useApp } from '../src/context/AppContext'
import { makeHabit, makeState, memoryStorage } from './fixtures'
vi.mock('../src/utils/editingSession', () => ({ openEditingSession: async storage => ({
  save: state => storage.setItem('namami-state-v1', state), renew: async () => {}, release: async () => {},
}) }))
vi.mock('localforage', () => ({ default: { config: vi.fn(), getItem: vi.fn(), setItem: vi.fn() } }))
afterEach(async () => { await act(async () => {}) })
it.each([[100, 95, 'points-100'], [500, 490, 'points-500']])('L07: awards the %i lifetime badge after %i has already been spent', async (earned, spent, badgeId) => {
  const state = makeState({ habits: [makeHabit({ history: { '2020-01-01': true }, customPoints: earned, freezeDates: {} })],
    settings: { ...makeState().settings, dailyBonus: 0 },
    earnedBadges: [], claimedRewards: [{ rewardId: 'old-reward', cost: spent }], manualAdjustment: 0 })
  Object.assign(localforage, memoryStorage({ 'namami-state-v1': state }))
  const app = renderHook(useApp, { wrapper: ({ children }) => <AppProvider>{children}</AppProvider> })
  await waitFor(() => expect(app.result.current.loading).toBe(false))
  expect(app.result.current.points).toBe(earned - spent)
  await waitFor(() => expect(app.result.current.earnedBadges.some(b => b.badgeId === badgeId)).toBe(true))
  act(() => app.result.current.adjustMithura(5))
  expect(app.result.current.earnedBadges.filter(b => b.badgeId === badgeId)).toHaveLength(1)
})
