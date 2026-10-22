import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import localforage from 'localforage'
import App from '../src/App'
import { makeState, memoryStorage } from './fixtures'
vi.mock('../src/utils/editingSession', () => ({ openEditingSession: async storage => ({
  save: state => storage.setItem('namami-state-v1', state), renew: async () => {}, release: async () => {},
}) }))
vi.mock('localforage', () => ({ default: { config: vi.fn(), getItem: vi.fn(), setItem: vi.fn() } }))
beforeEach(() => Object.assign(localforage, memoryStorage({ 'namami-state-v1': makeState() })))
afterEach(async () => {
  await act(async () => {})
  delete window.triggerInstall
  delete window.__NAMAMI_INSTALL_READY
  delete Element.prototype.scrollIntoView
  window.history.replaceState({}, '', '/')
})
it('removes a consumed install prompt after dismissal instead of leaving an inert button', async () => {
  window.__NAMAMI_INSTALL_READY = true
  window.triggerInstall = vi.fn(async () => { window.__NAMAMI_INSTALL_READY = false })
  render(<App />)
  fireEvent.click(await screen.findByRole('button', { name: /^install$/i }))
  await waitFor(() => expect(screen.queryByRole('button', { name: /^install$/i })).toBeNull())
  expect(window.triggerInstall).toHaveBeenCalledTimes(1)
})
it.each([['add', 'habit-name'], ['checkins', 'checkins']])('honors the installed %s shortcut after hydration', async (mode, id) => {
  const scrolled = []
  Element.prototype.scrollIntoView = function () { scrolled.push(this.id) }
  window.history.replaceState({}, '', '/?mode=' + mode)
  render(<App />)
  await waitFor(() => expect(scrolled).toEqual([id]))
  if (mode === 'add') expect(document.activeElement.id).toBe('habit-name')
})
