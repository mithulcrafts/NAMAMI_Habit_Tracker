// @vitest-environment node
import { expect, it } from 'vitest'
import { createWorker } from './service-worker-fixture'

it('P01: offline navigation uses the most recent navigation shell before the install-time shell', async () => {
  const worker = await createWorker()
  worker.fetch.mockResolvedValueOnce(new Response('latest shell', { headers: { 'content-type': 'text/html' } }))
  expect(await (await worker.request('/')).text()).toBe('latest shell')
  expect(await (await worker.request('/')).text()).toBe('latest shell')
})
it('still opens the install-time shell offline before any navigation has been cached', async () => {
  const worker = await createWorker()
  expect(await (await worker.request('/')).text()).toBe('precache shell')
})
