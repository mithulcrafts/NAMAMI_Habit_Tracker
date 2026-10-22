// @vitest-environment node
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { expect, it, vi } from 'vitest'
import { renderOfflineWorker } from '../build/offlineAssets'

const template = readFileSync(new URL('../public/service-worker.js', import.meta.url), 'utf8')
const bundle = {
  'assets/app-123.js': { type: 'chunk', code: 'application code' },
  'assets/app-456.css': { type: 'asset', source: 'application styles' },
  'index.html': { type: 'asset', source: 'shell' },
}
it('P03: installation precaches the exact generated JavaScript and styles before it can activate', async () => {
  const worker = renderOfflineWorker(template, bundle)
  let install
  const addAll = vi.fn(async () => {})
  const cacheOpen = vi.fn(async () => ({ addAll }))
  vm.runInNewContext(worker, { self: { addEventListener: (name, handler) => { if (name === 'install') install = handler } }, caches: { open: cacheOpen } })
  let promise
  install({ waitUntil: work => { promise = work } })
  await promise
  expect(addAll.mock.calls[0][0]).toContain('/assets/app-123.js')
  expect(addAll.mock.calls[0][0]).toContain('/assets/app-456.css')
  expect(cacheOpen.mock.calls[0][0]).toMatch(/^namami-cache-v8-[0-9a-f]{16}$/)
})
it('changes the cache version for a changed build and is deterministic for the same build', () => {
  const first = renderOfflineWorker(template, bundle)
  expect(renderOfflineWorker(template, bundle)).toBe(first)
  const changed = renderOfflineWorker(template, { ...bundle, 'index.html': { type: 'asset', source: 'new shell' } })
  expect(changed.match(/const CACHE_VERSION = .*;/)[0]).not.toBe(first.match(/const CACHE_VERSION = .*;/)[0])
  expect(template).toContain('/* BUILD_ASSETS */')
})
