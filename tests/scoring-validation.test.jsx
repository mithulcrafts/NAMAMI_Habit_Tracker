import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import localforage from 'localforage'
import { AppProvider, useApp } from '../src/context/AppContext'
import { Rewards } from '../src/components/Rewards'
import { Settings } from '../src/pages/Settings'
import { makeState, memoryStorage } from './fixtures'

vi.mock('../src/utils/editingSession', () => ({ openEditingSession: async storage => ({
  save: state => storage.setItem('namami-state-v1', state), renew: async () => {}, release: async () => {},
}) }))
vi.mock('localforage', () => ({ default: { config: vi.fn(), getItem: vi.fn(), setItem: vi.fn() } }))
let storage
const wrapper = ({ children }) => <AppProvider>{children}</AppProvider>
beforeEach(() => {
  storage = memoryStorage({ 'namami-state-v1': makeState({
    rewards: [{ id: 'r', name: 'Tea', requiredPoints: 50 }], manualAdjustment: -300,
  }) })
  Object.assign(localforage, storage)
  vi.spyOn(window, 'alert').mockImplementation(() => {})
})
const mount = async () => {
  const app = renderHook(() => useApp(), { wrapper })
  await waitFor(() => expect(app.result.current.loading).toBe(false))
  await act(async () => {})
  return app
}

it.each([-50, 0, NaN, Infinity])('L06: rejects invalid reward cost %s on create and edit', async requiredPoints => {
  const app = await mount()
  act(() => app.result.current.addReward({ name: 'Bad', requiredPoints }))
  act(() => app.result.current.updateReward('r', { requiredPoints }))
  expect(app.result.current.rewards).toEqual([{ id: 'r', name: 'Tea', requiredPoints: 50 }])
  act(() => app.result.current.claimReward('r'))
  expect(app.result.current.claimedRewards.at(-1).cost).toBe(50)
})

it('does not allow a malformed stored reward to be claimed or rewrite its old claim', async () => {
  const original = storage.records.get('namami-state-v1')
  original.rewards[0].requiredPoints = -50
  const app = await mount()
  act(() => app.result.current.claimReward('r'))
  expect(app.result.current.claimedRewards).toEqual(original.claimedRewards)
  expect(app.result.current.rewards[0].requiredPoints).toBe(-50)
})

it.each([-1, NaN, Infinity])('rejects invalid scoring values %s without changing saved configuration', async value => {
  const app = await mount()
  const original = structuredClone(storage.records.get('namami-state-v1'))
  act(() => app.result.current.updateSettings({ dailyBonus: value }))
  act(() => app.result.current.updateSettings({ globalStreakBonuses: { 3: value } }))
  act(() => app.result.current.updateHabit('real-habit', { customPoints: value }))
  act(() => app.result.current.updateHabit('real-habit', { customStreakBonuses: { 3: value } }))
  act(() => app.result.current.updateHabitGamification('real-habit', false, value, { 3: 1 }))
  act(() => app.result.current.addHabit({ name: 'Bad scoring', customPoints: value }))
  await act(async () => {})
  expect(storage.records.get('namami-state-v1')).toEqual(original)
})

it('allows zero bonuses and legitimate signed manual refunds, but rejects non-finite adjustments', async () => {
  const app = await mount()
  act(() => app.result.current.updateSettings({ dailyBonus: 0, globalStreakBonuses: { 3: 0, 7: 0, 30: 0 } }))
  expect(app.result.current.settings.dailyBonus).toBe(0)
  act(() => app.result.current.updateHabit('real-habit', { customPoints: 0 }))
  expect(app.result.current.habits[0].customPoints).toBe(0)
  act(() => app.result.current.adjustMithura(-20))
  act(() => app.result.current.adjustMithura(10))
  act(() => app.result.current.adjustMithura(Infinity))
  act(() => app.result.current.adjustMithura(NaN))
  await act(async () => {})
  expect(storage.records.get('namami-state-v1').manualAdjustment).toBe(-310)
})

it('rejects a negative reward through the actual Save edit button', () => {
  const onUpdate = vi.fn()
  render(<Rewards rewards={[{ id: 'r', name: 'Tea', requiredPoints: 50 }]} points={100} onUpdate={onUpdate} />)
  fireEvent.click(screen.getByRole('button', { name: /^edit$/i }))
  fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '-50' } })
  fireEvent.click(screen.getByRole('button', { name: /save edit/i }))
  expect(onUpdate).not.toHaveBeenCalled()
  expect(screen.getByRole('button', { name: /save edit/i })).toBeTruthy()
})

it('rejects negative bonuses through Save settings', () => {
  const onUpdate = vi.fn()
  render(<Settings settings={makeState().settings} onUpdate={onUpdate} />)
  fireEvent.change(screen.getByLabelText('DAILY BONUS (ALL HABITS DONE)'), { target: { value: '-1' } })
  fireEvent.click(screen.getByRole('button', { name: /save settings/i }))
  expect(onUpdate).not.toHaveBeenCalled()
})
