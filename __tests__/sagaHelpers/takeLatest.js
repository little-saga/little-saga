import EventEmitter from 'events'
import { cancel, PrimaryEnv, take, takeLatest } from '../../src/compat'
import { deferred, noop } from '../../src'
import { connectToEmitter } from '../../src/channel-utils'

test('takeLatest', () => {
  const defs = [deferred(), deferred(), deferred(), deferred()]

  const actual = []
  const emitter = new EventEmitter()

  new PrimaryEnv(noop).use(connectToEmitter(emitter)).run(root)

  function* root() {
    const task = yield takeLatest('ACTION', worker, 'a1', 'a2')
    yield take('CANCEL_WATCHER')
    yield cancel(task)
  }

  function* worker(arg1, arg2, action) {
    const idx = action.payload - 1
    const response = yield defs[idx].promise
    actual.push([arg1, arg2, response])
  }

  return Promise.resolve(1)
    .then(() => emitter.emit('action', { type: 'ACTION', payload: 1 }))
    .then(() => emitter.emit('action', { type: 'ACTION', payload: 2 }))
    .then(() => defs[0].resolve('w-1'))
    .then(() => emitter.emit('action', { type: 'ACTION', payload: 3 }))
    .then(() => defs[1].resolve('w-2'))
    .then(() => defs[2].resolve('w-3'))
    .then(() => {
      emitter.emit('action', { type: 'ACTION', payload: 4 })
      /*
      We immediately cancel the watcher after firing the action
      The watcher should be canceleld after this
      no further task should be forked
      the last forked task should also be cancelled
    */
      emitter.emit('action', { type: 'CANCEL_WATCHER' })
    })
    .then(() => defs[3].resolve('w-4'))
    .then(() => {
      // this one should be ignored by the watcher
      emitter.emit('action', { type: 'ACTION', payload: 5 })
    })
    .then(() => {
      // takeLatest must cancel current task before forking a new task
      expect(actual).toEqual([['a1', 'a2', 'w-3']])
    })
})
