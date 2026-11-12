import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { build } from 'esbuild'

const compiled = await build({ entryPoints: ['src/services/sstvZip.ts'], bundle: true, platform: 'node', format: 'esm', write: false })
const { createSstvZip, historyImageName, safeImageName } = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].contents).toString('base64')}`)
assert.equal(safeImageName('../a.png'), '.._a')
assert.match(historyImageName('PD 90', new Date(2026, 10, 12, 9, 8, 7, 42).getTime()), /^PD 90-20261112-090807$/)
const zip = await createSstvZip([
  { name: '测试', image: new Blob(['first']), createdAt: Date.now() },
  { name: '测试', image: new Blob(['second']), createdAt: Date.now() },
  { name: '../a', image: new Blob(['third']), createdAt: Date.now() }
])
const checked = spawnSync('python3', ['-c', `
import io, sys, zipfile
with zipfile.ZipFile(io.BytesIO(sys.stdin.buffer.read())) as archive:
    assert archive.testzip() is None
    assert archive.namelist() == ['测试.png', '测试 (2).png', '.._a.png']
    assert [archive.read(name) for name in archive.namelist()] == [b'first', b'second', b'third']
`], { input: Buffer.from(await zip.arrayBuffer()) })
assert.equal(checked.status, 0, checked.stderr.toString())
console.log('SSTV ZIP 名称、重复文件和内容检查通过')
