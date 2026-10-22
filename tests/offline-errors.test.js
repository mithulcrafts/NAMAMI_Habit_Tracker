// @vitest-environment node
import { expect, it } from 'vitest'
import { createWorker } from './service-worker-fixture'

it.each([404, 503])('P02: a navigation HTTP %i cannot replace the working offline shell', async status => {
  const w = await createWorker()
  w.fetch.mockResolvedValueOnce(new Response('working shell', { headers: { 'content-type': 'text/html' } }))
  await w.request('/')
  w.fetch.mockResolvedValueOnce(new Response('Server error', { status }))
  expect(await (await w.request('/')).text()).toBe('working shell')
  expect(await (await w.request('/')).text()).toBe('working shell')
})
it.each(['script', 'style'])('preserves cached %s through an error and never serves an HTML shell for a missing asset', async destination => {
  const w = await createWorker()
  const options = { destination, mode: 'cors', headers: new Headers() }
  w.fetch.mockResolvedValueOnce(new Response('working asset', { headers: { 'content-type': destination === 'script' ? 'text/javascript' : 'text/css' } }))
  await w.request('/assets/app', options)
  w.fetch.mockResolvedValueOnce(new Response('error', { status: 503 }))
  expect(await (await w.request('/assets/app', options)).text()).toBe('working asset')
  expect((await w.request('/assets/missing', options)).type).toBe('error')
  w.fetch.mockResolvedValueOnce(new Response('<html>SPA fallback</html>', { headers: { 'content-type': 'text/html' } }))
  expect((await w.request('/assets/missing', options)).type).toBe('error')
})
it('keeps a working image when background refresh returns 404', async () => {
  const w = await createWorker()
  const options = { destination: 'image', mode: 'cors', headers: new Headers() }
  w.fetch.mockResolvedValueOnce(new Response('image bytes', { headers: { 'content-type': 'image/png' } }))
  await w.request('/picture.png', options)
  w.fetch.mockResolvedValueOnce(new Response('missing', { status: 404 }))
  expect(await (await w.request('/picture.png', options)).text()).toBe('image bytes')
  expect(await (await w.request('/picture.png', options)).text()).toBe('image bytes')
})
it('returns the successful network response even when cache storage is unavailable', async () => {
  const w = await createWorker()
  w.caches.open.mockRejectedValue(new Error('Quota exceeded'))
  w.fetch.mockResolvedValueOnce(new Response('fresh network shell', { headers: { 'content-type': 'text/html' } }))
  expect(await (await w.request('/')).text()).toBe('fresh network shell')
})
it('waits for old app windows to close before activating an update', async () => {
  const w = await createWorker()
  expect(w.self.skipWaiting).not.toHaveBeenCalled()
  w.listeners.get('message')?.({ data: { type: 'SKIP_WAITING' } })
  expect(w.self.skipWaiting).not.toHaveBeenCalled()
})
it('activation removes only obsolete NAMAMI asset caches, with no application-data APIs', async () => {
  const w = await createWorker()
  await w.caches.open('namami-cache-v7')
  await w.caches.open('unrelated-cache')
  await w.lifecycle('activate')
  expect(w.caches.delete).toHaveBeenCalledWith('namami-cache-v7')
  expect(w.stores.has('unrelated-cache')).toBe(true)
  expect(w.stores.has('namami-cache-v8')).toBe(true)
  // The VM supplies no IndexedDB or localStorage; touching either would throw.
})
