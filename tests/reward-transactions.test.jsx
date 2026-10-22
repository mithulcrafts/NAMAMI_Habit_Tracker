import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import localforage from 'localforage'
import { AppProvider, useApp } from '../src/context/AppContext'
import { makeState, memoryStorage } from './fixtures'
vi.mock('../src/utils/editingSession', () => ({ openEditingSession: async storage => ({
  save: state => storage.setItem('namami-state-v1', state), renew: async () => {}, release: async () => {},
}) }))
vi.mock('localforage', () => ({ default: { config: vi.fn(), getItem: vi.fn(), setItem: vi.fn() } }))
let storage
beforeEach(() => {
  storage = memoryStorage({ 'namami-state-v1': makeState({ habits: [], rewards: [{ id: 'r', name: 'Tea', requiredPoints: 60 }],
    claimedRewards: [], manualAdjustment: -90, streakFreezes: 0 }) })
  Object.assign(localforage, storage)
})
afterEach(async () => { await act(async () => {}) })
const mount = async () => {
  const app = renderHook(useApp, { wrapper: ({ children }) => <AppProvider>{children}</AppProvider> })
  await waitFor(() => expect(app.result.current.loading).toBe(false))
  return app
}
it('cannot spend the same balance twice when reward claims arrive before a re-render', async () => {
  const app = await mount()
  act(() => { app.result.current.claimReward('r'); app.result.current.claimReward('r') })
  expect(app.result.current.claimedRewards).toHaveLength(1)
  expect(app.result.current.points).toBe(30)
})
it('cannot buy two freezes or a reward plus a freeze with only enough for one', async () => {
  const app = await mount()
  act(() => { app.result.current.buyStreakFreeze(); app.result.current.buyStreakFreeze(); app.result.current.claimReward('r') })
  expect(app.result.current.streakFreezes).toBe(1)
  expect(app.result.current.claimedRewards).toHaveLength(1)
  expect(app.result.current.points).toBe(30)
})
it('checks the latest reward cost and deletion state instead of an old event handler snapshot', async () => {
  const app = await mount()
  const claim = app.result.current.claimReward
  act(() => { app.result.current.updateReward('r', { requiredPoints: 100 }); claim('r') })
  expect(app.result.current.claimedRewards).toHaveLength(0)
  act(() => { app.result.current.updateReward('r', { requiredPoints: 30 }); claim('r') })
  expect(app.result.current.claimedRewards[0].cost).toBe(30)
  act(() => { app.result.current.deleteReward('r'); claim('r') })
  expect(app.result.current.claimedRewards).toHaveLength(1)
})
