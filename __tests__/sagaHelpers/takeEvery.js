import EventEmitter from 'events'
import { cancel, take, takeEvery } from '../../src/compat'
import { noop } from '../../src'

test('takeEvery', async () => {
  const loop = 10

  const actual = []
  const emitter = new EventEmitter()
  const mainTask = new PrimaryEnv(noop).use(connectToEmitter(emitter)).run(root)

  function* root() {
    const task = yield takeEvery('ACTION', worker, 'a1', 'a2')
    yield take('CANCEL_WATCHER')
    yield cancel(task)
  }

  function* worker(arg1, arg2, action) {
    actual.push([arg1, arg2, action.payload])
  }

  const inputTask = Promise.resolve(1)
    .then(() => {
      for (let i = 1; i <= loop / 2; i++) {
        emitter.emit('action', { type: 'ACTION', payload: i })
      }
    })
    // the watcher should be cancelled after this
    // no further task should be forked after this
    .then(() => emitter.emit('action', { type: 'CANCEL_WATCHER' }))
    .then(() => {
      for (let i = loop / 2 + 1; i <= loop; i++) {
        emitter.emit('action', { type: 'ACTION', payload: i })
      }
    })

  await Promise.all([mainTask.toPromise(), inputTask])
  // takeEvery must fork a worker on each action
  expect(actual).toEqual([
    ['a1', 'a2', 1],
    ['a1', 'a2', 2],
    ['a1', 'a2', 3],
    ['a1', 'a2', 4],
    ['a1', 'a2', 5],
  ])
})
