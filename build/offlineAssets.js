import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

export const renderOfflineWorker = (template, bundle) => {
  const assets = Object.keys(bundle).filter(name => name !== 'index.html' && !name.endsWith('.map')).sort()
  const fingerprint = createHash('sha256').update(template)
  for (const name of Object.keys(bundle).sort()) {
    const file = bundle[name]
    fingerprint.update(name).update(file.type === 'chunk' ? file.code : file.source)
  }
  const version = `v8-${fingerprint.digest('hex').slice(0, 16)}`
  return template.replace("const CACHE_VERSION = 'v8';", `const CACHE_VERSION = '${version}';`)
    .replace('/* BUILD_ASSETS */', assets.map(name => JSON.stringify('/' + name)).join(', '))
}

// Vite copies public files before writeBundle. Stamp that emitted worker with
// this exact build's assets; never modify the checked-in template at build time.
export const offlineAssets = () => ({
  name: 'namami-offline-assets',
  apply: 'build',
  async writeBundle(options, bundle) {
    const file = resolve(options.dir, 'service-worker.js')
    const template = await readFile(file, 'utf8')
    await writeFile(file, renderOfflineWorker(template, bundle))
  },
})
