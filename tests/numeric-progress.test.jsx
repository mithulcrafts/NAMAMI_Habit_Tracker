import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import localforage from 'localforage'
import { AppProvider, useApp } from '../src/context/AppContext'
import { HabitCard } from '../src/components/HabitCard'
import { makeHabit, makeState, memoryStorage } from './fixtures'

vi.mock('../src/utils/editingSession', () => ({ openEditingSession: async storage => ({
  save: state => storage.setItem('namami-state-v1', state), renew: async () => {}, release: async () => {},
}) }))
vi.mock('localforage', () => ({ default: { config: vi.fn(), getItem: vi.fn(), setItem: vi.fn() } }))
let storage
const wrapper = ({ children }) => <AppProvider>{children}</AppProvider>
beforeEach(() => {
  storage = memoryStorage({ 'namami-state-v1': makeState({ habits: [makeHabit({ goalType: 'count', goalTarget: 10 })] }) })
  Object.assign(localforage, storage)
})

it.each([-1, NaN, Infinity, -Infinity, '5', null])('L05: rejects invalid numeric progress %s without changing history or freezes', async value => {
  const app = renderHook(() => useApp(), { wrapper })
  await waitFor(() => expect(app.result.current.loading).toBe(false))
  await act(async () => {})
  const saved = structuredClone(storage.records.get('namami-state-v1'))
  act(() => app.result.current.toggleCompletion('real-habit', '2020-01-03', true, value))
  await act(async () => {})
  expect(storage.records.get('namami-state-v1')).toEqual(saved)
  expect(app.result.current.streakFreezes).toBe(saved.streakFreezes)
})

it.each(['count', 'duration'])('accepts ordinary %s progress and zero resets', async goalType => {
  storage.records.get('namami-state-v1').habits[0].goalType = goalType
  const app = renderHook(() => useApp(), { wrapper })
  await waitFor(() => expect(app.result.current.loading).toBe(false))
  act(() => app.result.current.toggleCompletion('real-habit', '2020-01-04', true, 12.5))
  expect(app.result.current.habits[0].dailyValueHistory['2020-01-04']).toBe(12.5)
  expect(app.result.current.habits[0].history['2020-01-04']).toBe(true)
  act(() => app.result.current.toggleCompletion('real-habit', '2020-01-04', false, 0))
  expect(app.result.current.habits[0].dailyValueHistory['2020-01-04']).toBe(0)
  expect(app.result.current.habits[0].history['2020-01-04']).toBe(false)
})

it('rejects a negative value from the actual Log button without clearing the input', () => {
  vi.spyOn(window, 'alert').mockImplementation(() => {})
  const onToggle = vi.fn()
  render(<HabitCard habit={makeHabit({ goalType: 'count', goalTarget: 10, streak: 0, totalCompleted: 0 })} onToggle={onToggle} isToday />)
  const input = screen.getByRole('spinbutton')
  fireEvent.change(input, { target: { value: '-5' } })
  fireEvent.click(screen.getByRole('button', { name: /^log/i }))
  expect(onToggle).not.toHaveBeenCalled()
  expect(input.value).toBe('-5')
})
