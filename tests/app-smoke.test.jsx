import { StrictMode } from 'react'
import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import localforage from 'localforage'
import App from '../src/App'
import { AppProvider, useApp } from '../src/context/AppContext'
import { todayKey } from '../src/utils/date'
import { makeHabit, makeState, memoryStorage } from './fixtures'

vi.mock('../src/utils/editingSession', () => ({ openEditingSession: async storage => ({
  save: state => storage.setItem('namami-state-v1', state), renew: async () => {}, release: async () => {},
}) }))
vi.mock('localforage', () => ({ default: { config: vi.fn(), getItem: vi.fn(), setItem: vi.fn() } }))
let storage
const KEY = 'namami-state-v1'
beforeEach(() => {
  storage = memoryStorage({ [KEY]: makeState() })
  Object.assign(localforage, storage)
})

it('shows the load error and Retry without exposing sample controls, then recovers', async () => {
  storage.getItem.mockRejectedValue(new Error('Test storage failure'))
  render(<StrictMode><App /></StrictMode>)
  expect(await screen.findByRole('alert')).toBeTruthy()
  expect(screen.queryByText('Morning Walk')).toBeNull()
  expect(screen.queryByRole('button', { name: 'Home' })).toBeNull()
  expect(storage.setItem).not.toHaveBeenCalled()
  storage.getItem.mockImplementation(async key => structuredClone(storage.records.get(key) ?? null))
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
  expect(await screen.findByRole('button', { name: 'Home' })).toBeTruthy()
  expect(screen.queryByRole('alert')).toBeNull()
})

it('keeps Home, Rewards, Settings, habit creation, check-ins and theme saving working', async () => {
  render(<StrictMode><App /></StrictMode>)
  await screen.findByRole('button', { name: 'Home' })
  fireEvent.change(screen.getByLabelText('HABIT NAME'), { target: { value: 'New test habit' } })
  fireEvent.click(screen.getByRole('button', { name: /^add habit$/i }))
  await waitFor(() => expect(storage.records.get(KEY).habits).toHaveLength(2))
  fireEvent.click(screen.getAllByRole('button', { name: /mark done today/i })[0])
  await waitFor(() => expect(storage.records.get(KEY).habits.some(h => h.history[todayKey()])).toBe(true))
  fireEvent.click(screen.getByRole('button', { name: 'Rewards' }))
  expect(screen.getByText('STREAK FREEZE')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
  expect(screen.getByRole('button', { name: /save settings/i })).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: /save settings/i }))
  expect(document.documentElement.classList.contains('light')).toBe(true)
  fireEvent.click(screen.getByRole('button', { name: 'Home' }))
  expect(screen.getByLabelText('HABIT NAME')).toBeTruthy()
})

it('preserves numeric logs, freezes/refunds, reward costs, settings and signed adjustments through reload', async () => {
  const original = makeState({ habits: [makeHabit({ goalType: 'count', goalTarget: 10 })], manualAdjustment: -300 })
  storage.records.set(KEY, original)
  const wrapper = ({ children }) => <StrictMode><AppProvider>{children}</AppProvider></StrictMode>
  const app = renderHook(() => useApp(), { wrapper })
  await waitFor(() => expect(app.result.current.loading).toBe(false))
  act(() => app.result.current.toggleCompletion('real-habit', '2020-01-04', true, 12))
  expect(app.result.current.habits[0].dailyValueHistory['2020-01-04']).toBe(12)
  act(() => app.result.current.useStreakFreeze('real-habit', '2020-01-05'))
  expect(app.result.current.streakFreezes).toBe(1)
  act(() => app.result.current.toggleCompletion('real-habit', '2020-01-05', true, 10))
  expect(app.result.current.streakFreezes).toBe(2)
  expect(app.result.current.habits[0].freezeDates['2020-01-05']).toBeUndefined()
  act(() => app.result.current.buyStreakFreeze())
  expect(app.result.current.streakFreezes).toBe(3)
  act(() => app.result.current.addReward({ name: 'Tea', requiredPoints: 25 }))
  const reward = app.result.current.rewards.find(r => r.name === 'Tea')
  act(() => app.result.current.claimReward(reward.id))
  act(() => app.result.current.updateReward(reward.id, { requiredPoints: 99 }))
  act(() => app.result.current.deleteReward(reward.id))
  expect(app.result.current.claimedRewards.find(r => r.rewardId === reward.id).cost).toBe(25)
  act(() => app.result.current.adjustMithura(-20))
  act(() => app.result.current.updateSettings({ theme: 'dark', quoteCategory: 'gita' }))
  act(() => app.result.current.addCustomQuote('Another quote'))
  await waitFor(() => expect(storage.records.get(KEY).customQuotes).toContain('Another quote'))
  const saved = structuredClone(storage.records.get(KEY))
  expect(saved.manualAdjustment).toBe(-320)
  expect(saved.extraStateField).toEqual(original.extraStateField)
  app.unmount()
  const reopened = renderHook(() => useApp(), { wrapper })
  await waitFor(() => expect(reopened.result.current.loading).toBe(false))
  expect(storage.records.get(KEY)).toEqual(saved)
})
