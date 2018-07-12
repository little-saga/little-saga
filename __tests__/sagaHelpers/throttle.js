import EventEmitter from 'events'
import { cancel, delay, PrimaryEnv, take, throttle } from '../../src/compat'
import { noop } from '../../src'

jest.useFakeTimers()

test('throttle', () => {
  const emitter = new EventEmitter()

  const actual = []
  const expected = [
    ['a1', 'a2', 0],
    ['a1', 'a2', 10],
    ['a1', 'a2', 20],
    ['a1', 'a2', 30],
    ['a1', 'a2', 34],
  ]

  new PrimaryEnv(noop).use(connectToEmitter(emitter)).run(root)

  function* root() {
    const task = yield throttle(100, 'ACTION', worker, 'a1', 'a2')
    yield take('CANCEL_WATCHER')
    yield cancel(task)
  }

  function* worker(arg1, arg2, { payload }) {
    actual.push([arg1, arg2, payload])
  }

  const dispatchedActions = []
  for (let i = 0; i < 35; i++) {
    dispatchedActions.push(
      delay(i * 10, i)
        .then(val => emitter.emit('action', { type: 'ACTION', payload: val }))
        .then(() => jest.advanceTimersByTime(10)),
    )
  }

  Promise.resolve()
    .then(() => jest.advanceTimersByTime(1)) // just start for the smallest tick
    .then(() => jest.advanceTimersByTime(10)) // tick past first delay

  return (
    dispatchedActions[34]
      // wait so traling dispatch gets processed
      .then(() => jest.advanceTimersByTime(100))
      .then(() => emitter.emit('action', { type: 'CANCEL_WATCHER' }))
      // shouldn't be processed cause of geting canceled
      .then(() => emitter.emit('action', { type: 'ACTION', payload: 40 }))
      .then(() => {
        // throttle must ignore incoming actions during throttling interval
        expect(actual).toEqual(expected)
      })
  )
})
