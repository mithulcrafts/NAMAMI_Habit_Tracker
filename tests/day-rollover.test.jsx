import { act, fireEvent, render, renderHook, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import localforage from 'localforage'
import { AppProvider, useApp } from '../src/context/AppContext'
import { Home } from '../src/pages/Home'
import { useToday } from '../src/hooks/useToday'
import { makeHabit, makeState, memoryStorage } from './fixtures'

vi.mock('../src/utils/editingSession', () => ({ openEditingSession: async storage => ({
  save: state => storage.setItem('namami-state-v1', state), renew: async () => {}, release: async () => {},
}) }))
vi.mock('localforage', () => ({ default: { config: vi.fn(), getItem: vi.fn(), setItem: vi.fn() } }))
vi.mock('../src/components/GlobalHeatmap', () => ({ GlobalHeatmap: () => null }))
vi.mock('../src/components/Heatmap', () => ({ Heatmap: () => null }))
vi.mock('../src/components/HabitForm', () => ({ HabitForm: () => null }))
vi.mock('../src/components/DashboardStats', () => ({ DashboardStats: () => null }))
vi.mock('../src/components/QuoteCard', () => ({ QuoteCard: () => null }))
vi.mock('../src/components/HabitCard', () => ({ HabitCard: ({ selectedDateKey, onToggle }) =>
  <button onClick={() => onToggle('real-habit', selectedDateKey, true)}>Check in</button> }))
afterEach(() => vi.useRealTimers())

it('updates at local midnight without a click or reload and cancels its timer on unmount', () => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(2026, 9, 23, 23, 59, 59))
  const hook = renderHook(useToday)
  expect(hook.result.current).toBe('2026-10-23')
  act(() => vi.advanceTimersByTime(1100))
  expect(hook.result.current).toBe('2026-10-24')
  hook.unmount()
  expect(vi.getTimerCount()).toBe(0)
})

it.each(['focus', 'pageshow', 'visibilitychange'])('refreshes after a suspended phone resumes via %s', event => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(2026, 9, 23, 20))
  const hook = renderHook(useToday)
  vi.setSystemTime(new Date(2026, 9, 26, 10))
  act(() => (event === 'visibilitychange' ? document : window).dispatchEvent(new Event(event)))
  expect(hook.result.current).toBe('2026-10-26')
})

it('refreshes a stale streak and quote on resume without changing recorded history', async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 9, 23, 20))
  const history = { '2026-10-22': true }
  const storage = memoryStorage({ 'namami-state-v1': makeState({ habits: [makeHabit({ history, freezeDates: {} })] }) })
  Object.assign(localforage, storage)
  const app = renderHook(useApp, { wrapper: ({ children }) => <AppProvider>{children}</AppProvider> })
  await waitFor(() => expect(app.result.current.loading).toBe(false))
  expect(app.result.current.habits[0].streak).toBe(1)
  const quote = app.result.current.quoteOfDay
  vi.setSystemTime(new Date(2026, 9, 24, 10))
  act(() => window.dispatchEvent(new Event('focus')))
  expect(app.result.current.habits[0].streak).toBe(0)
  expect(app.result.current.quoteOfDay).not.toBe(quote)
  expect(app.result.current.habits[0].history).toEqual(history)
  await act(async () => {})
  expect(storage.records.get('namami-state-v1').habits[0].history).toEqual(history)
})

it('logs to the new day after midnight when Today was selected', () => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(2026, 9, 23, 23, 59, 59))
  const onToggle = vi.fn()
  const home = render(<Home habits={[makeHabit()]} onToggle={onToggle} />)
  act(() => vi.advanceTimersByTime(1100))
  fireEvent.click(home.getByText('Check in'))
  expect(onToggle).toHaveBeenCalledWith('real-habit', '2026-10-24', true)
  expect(home.getByRole('button', { name: 'Next day' }).disabled).toBe(true)
})

it('retains an explicitly selected historical date across midnight', () => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(2026, 9, 23, 23, 59, 59))
  const onToggle = vi.fn()
  const home = render(<Home habits={[makeHabit()]} onToggle={onToggle} />)
  fireEvent.click(home.getByRole('button', { name: 'Previous day' }))
  act(() => vi.advanceTimersByTime(1100))
  fireEvent.click(home.getByText('Check in'))
  expect(onToggle).toHaveBeenCalledWith('real-habit', '2026-10-22', true)
})
