// @vitest-environment node
import { execFileSync } from 'node:child_process'
import process from 'node:process'
import { expect, it } from 'vitest'

const moduleURL = new URL('../src/utils/date.js', import.meta.url).href
it.each(['America/Los_Angeles', 'America/New_York', 'Asia/Kolkata', 'Pacific/Auckland', 'UTC'])(
  'L10: preserves calendar dates and Sunday week boundaries in %s', timezone => {
    const script = `
      import { formatDate, startOfWeek, getWeekBuckets } from ${JSON.stringify(moduleURL)};
      const keys = ['2026-10-25', '2026-03-08', '2026-11-01', '2024-02-29', '2026-01-01'];
      console.log(JSON.stringify({
        formatted: keys.map(formatDate),
        weeks: keys.map(startOfWeek),
        buckets: getWeekBuckets({ '2026-10-25': true, '2026-10-26': true, '2026-11-01': true, '2026-11-02': false }),
        timestamp: formatDate(new Date(2026, 9, 25, 15, 30)),
      }));
    `
    const output = execFileSync(process.execPath, ['--input-type=module', '-e', script], {
      env: { ...process.env, TZ: timezone }, encoding: 'utf8',
    })
    const result = JSON.parse(output)
    expect(result.formatted).toEqual(['2026-10-25', '2026-03-08', '2026-11-01', '2024-02-29', '2026-01-01'])
    expect(result.weeks).toEqual(['2026-10-25', '2026-03-08', '2026-11-01', '2024-02-25', '2025-12-28'])
    expect(result.buckets).toEqual({ '2026-10-25': 2, '2026-11-01': 1 })
    expect(result.timestamp).toBe('2026-10-25')
  },
)
