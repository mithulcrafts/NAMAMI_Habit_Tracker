import { StrictMode } from 'react'
import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import localforage from 'localforage'
import { AppProvider, useApp } from '../src/context/AppContext'
import App from '../src/App'
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
const wrapper = ({ children }) => <StrictMode><AppProvider>{children}</AppProvider></StrictMode>
const mount = async () => {
  const app = renderHook(() => useApp(), { wrapper })
  await waitFor(() => expect(app.result.current.loading).toBe(false))
  return app
}

it('D02: preserves a check-in made while the actual edit form is open', async () => {
  render(<StrictMode><App /></StrictMode>)
  fireEvent.click(await screen.findByRole('button', { name: /^edit$/i }))
  fireEvent.click(screen.getByRole('button', { name: /mark done today/i }))
  fireEvent.change(screen.getByLabelText('HABIT NAME'), { target: { value: 'Renamed habit' } })
  fireEvent.click(screen.getByRole('button', { name: /save changes/i }))
  await waitFor(() => expect(storage.records.get(KEY).habits[0].name).toBe('Renamed habit'))
  expect(storage.records.get(KEY).habits[0].history[todayKey()]).toBe(true)
})

it('D02/D06: preserves freezes and consumed inventory when a stale edit is saved', async () => {
  const app = await mount()
  const stale = structuredClone(app.result.current.habits[0])
  act(() => app.result.current.useStreakFreeze(stale.id, '2020-01-05'))
  act(() => app.result.current.updateHabit(stale.id, { ...stale, name: 'Renamed' }))
  expect(app.result.current.habits[0].freezeDates['2020-01-05']).toBe(true)
  expect(app.result.current.streakFreezes).toBe(1)
  act(() => app.result.current.removeStreakFreeze(stale.id, '2020-01-05'))
  expect(app.result.current.streakFreezes).toBe(2)
})

it.each(['count', 'duration'])('preserves new %s logs and tracking metadata', async goalType => {
  storage.records.set(KEY, makeState({ habits: [makeHabit({ goalType, goalTarget: 10 })] }))
  const app = await mount()
  const stale = structuredClone(app.result.current.habits[0])
  act(() => app.result.current.toggleCompletion(stale.id, '2020-01-05', true, 15))
  act(() => app.result.current.updateHabit(stale.id, { ...stale, name: 'Renamed', id: 'wrong-id', createdAt: '2099-01-01', extraHabitField: 'overwrite' }))
  const habit = app.result.current.habits[0]
  expect(habit.id).toBe(stale.id)
  expect(habit.createdAt).toBe(stale.createdAt)
  expect(habit.dailyValueHistory['2020-01-05']).toBe(15)
  expect(habit.history['2020-01-05']).toBe(true)
  expect(habit.extraHabitField).toEqual(stale.extraHabitField)
})

it('keeps all intended editable fields and partial updates working', async () => {
  const app = await mount()
  const fields = { name: 'Updated', description: 'Description', frequency: 'custom', customDays: [1, 3],
    isDailyHabit: false, targetDays: 21, goalType: 'count', goalTarget: 8,
    habitColor: '#00FFA3', customPoints: 12, customStreakBonuses: { 3: 3, 7: 8, 30: 12 } }
  act(() => app.result.current.updateHabit('real-habit', fields))
  expect(app.result.current.habits[0]).toMatchObject(fields)
  act(() => app.result.current.updateHabit('real-habit', { name: 'Renamed again' }))
  expect(app.result.current.habits[0]).toMatchObject({ ...fields, name: 'Renamed again' })
  expect(app.result.current.habits[0].history).toEqual(makeHabit().history)
})
