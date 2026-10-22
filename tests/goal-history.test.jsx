import { act, render, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import localforage from 'localforage'
import CalendarHeatmap from 'react-calendar-heatmap'
import { AppProvider, useApp } from '../src/context/AppContext'
import { Heatmap } from '../src/components/Heatmap'
import { GlobalHeatmap } from '../src/components/GlobalHeatmap'
import { todayKey, getPastDate } from '../src/utils/date'
import { makeHabit, makeState, memoryStorage } from './fixtures'

vi.mock('../src/utils/editingSession', () => ({ openEditingSession: async storage => ({
  save: state => storage.setItem('namami-state-v1', state), renew: async () => {}, release: async () => {},
}) }))
vi.mock('localforage', () => ({ default: { config: vi.fn(), getItem: vi.fn(), setItem: vi.fn() } }))
vi.mock('react-calendar-heatmap', () => ({ default: vi.fn(() => null) }))
let storage
const KEY = 'namami-state-v1'
const wrapper = ({ children }) => <AppProvider>{children}</AppProvider>
beforeEach(() => {
  storage = memoryStorage({ [KEY]: makeState() })
  Object.assign(localforage, storage)
})
const mount = async () => {
  const app = renderHook(() => useApp(), { wrapper })
  await waitFor(() => expect(app.result.current.loading).toBe(false))
  return app
}

it.each([[10, 20, true], [20, 10, false]])('L03: editing target %s to %s preserves recorded completion %s', async (before, after, completed) => {
  const history = { [getPastDate(1)]: completed, [todayKey()]: completed }
  const values = { [getPastDate(1)]: 15, [todayKey()]: 15 }
  storage.records.set(KEY, makeState({ habits: [makeHabit({ goalType: 'count', goalTarget: before, history, dailyValueHistory: values, freezeDates: {} })] }))
  const app = await mount()
  const pointsBefore = app.result.current.lifetimePoints
  act(() => app.result.current.updateHabit('real-habit', { goalTarget: after }))
  expect(app.result.current.habits[0].totalCompleted).toBe(completed ? 2 : 0)
  expect(app.result.current.habits[0].streak).toBe(completed ? 2 : 0)
  expect(app.result.current.lifetimePoints).toBe(pointsBefore)
  expect(app.result.current.habits[0].history).toEqual(history)
  expect(app.result.current.habits[0].dailyValueHistory).toEqual(values)
  // An explicit new log uses the NEW goal, including when editing today's log.
  act(() => app.result.current.toggleCompletion('real-habit', todayKey(), 15 >= after, 15))
  expect(app.result.current.habits[0].history[todayKey()]).toBe(15 >= after)
})

it.each([['binary', 'count'], ['binary', 'duration'], ['count', 'binary'], ['duration', 'count']])('L04: changing %s to %s preserves old results and raw values after reload', async (before, after) => {
  const original = makeHabit({ goalType: before, goalTarget: before === 'binary' ? null : 10,
    history: { [getPastDate(1)]: true }, dailyValueHistory: before === 'binary' ? {} : { [getPastDate(1)]: 15 } })
  storage.records.set(KEY, makeState({ habits: [original] }))
  const app = await mount()
  act(() => app.result.current.updateHabit('real-habit', { goalType: after, goalTarget: after === 'binary' ? null : 20 }))
  expect(app.result.current.habits[0].totalCompleted).toBe(1)
  expect(app.result.current.habits[0].streak).toBe(1)
  await act(async () => {})
  expect(storage.records.get(KEY).habits[0].history).toEqual(original.history)
  expect(storage.records.get(KEY).habits[0].dailyValueHistory).toEqual(original.dailyValueHistory)
  app.unmount()
  const reopened = await mount()
  expect(reopened.result.current.habits[0].totalCompleted).toBe(1)
})

it('keeps completed cells filled even when old binary days have no numeric value', () => {
  const h = makeHabit({ goalType: 'count', goalTarget: 20, history: { [todayKey()]: true } })
  render(<Heatmap {...h} />)
  const props = CalendarHeatmap.mock.calls.at(-1)[0]
  const cell = props.values.find(v => v.date === todayKey())
  expect(props.classForValue(cell)).toBe('color-github-4')
})

it('does not turn a recorded incomplete cell into a completed cell after lowering the target', () => {
  const h = makeHabit({ goalType: 'count', goalTarget: 5, history: { [todayKey()]: false }, dailyValueHistory: { [todayKey()]: 5 } })
  render(<Heatmap {...h} />)
  const props = CalendarHeatmap.mock.calls.at(-1)[0]
  expect(props.classForValue(props.values.find(v => v.date === todayKey()))).not.toBe('color-github-4')
})

it('aggregates recorded results consistently in the overall heatmap', () => {
  render(<GlobalHeatmap habits={[
    makeHabit({ id: 'a', goalType: 'count', goalTarget: 20, history: { [todayKey()]: true } }),
    makeHabit({ id: 'b', goalType: 'count', goalTarget: 5, history: { [todayKey()]: false }, dailyValueHistory: { [todayKey()]: 5 } }),
  ]} />)
  const props = CalendarHeatmap.mock.calls.at(-1)[0]
  expect(props.values.find(v => v.date === todayKey()).count).toBe(1)
})
