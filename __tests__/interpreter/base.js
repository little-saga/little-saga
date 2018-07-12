import EventEmitter from 'events'
import { io, is, noop, runSaga, stdChannel } from '../../src'

const run = fn => runSaga({}, fn)

test('saga iteration', async done => {
  let actual = []

  const task = run(function*() {
    actual.push(yield 1)
    actual.push(yield 2)
    return 3
  })

  expect(is.promise(task.toPromise())).toBe(true)
  expect(actual).toEqual([1, 2])
  expect(await task.toPromise()).toBe(3)
  expect(task.isRunning).toBe(false)

  done()
})

test('saga error handling', done => {
  function fnThrow() {
    throw new Error('error')
  }
  const task1 = runSaga({ cont: noop }, function*() {
    fnThrow()
  })

  task1.toPromise().catch(err => {
    // saga must return a rejected promise if generator throws an uncaught error
    expect(err.message).toBe('error')
    done()
  })

  /* try + catch + finally */
  let actual = []
  function* genFinally() {
    try {
      fnThrow()
      actual.push('unerachable')
    } catch (error) {
      actual.push('caught-' + error.message)
    } finally {
      actual.push('finally')
    }
  }

  run(genFinally)
    .toPromise()
    .then(() => {
      // saga must route to catch/finally blocks in the generator
      expect(actual).toEqual(['caught-error', 'finally'])
    })
})

test('saga output handling', async () => {
  let actual = []
  const emitter = new EventEmitter()
  const channel = stdChannel().enhancePut(put => {
    emitter.on('action', action => put(action))
    return action => emitter.emit('action', action)
  })

  emitter.on('action', action => actual.push(action.type))

  function* genFn(arg) {
    yield io.put({ type: arg })
    yield io.put({ type: 2 })
  }

  await runSaga({ channel }, genFn, 'arg').toPromise()
  const expected = ['arg', 2]
  expect(actual).toEqual(expected)
})

test('saga yielded falsy values', async () => {
  let actual = []

  await run(function*() {
    actual.push(yield false)
    actual.push(yield undefined)
    actual.push(yield null)
    actual.push(yield '')
    actual.push(yield 0)
    actual.push(yield NaN)
  }).toPromise()

  const expected = [false, undefined, null, '', 0, NaN]
  expect(actual).toEqual(expected)
})
