import { io, runSaga } from '../../src'

test('saga cps call handling', () => {
  let actual = []

  const task = runSaga({}, function* genFn() {
    try {
      yield io.cps(cb => {
        actual.push('call 1')
        cb('err')
      })
      actual.push('call 2')
    } catch (err) {
      actual.push('call ' + err)
    }
  })

  const expected = ['call 1', 'call err']

  return task.toPromise().then(() => {
    // saga must fulfill cps call effects
    expect(actual).toEqual(expected)
  })
})

test('saga synchronous cps failures handling', () => {
  let actual = []

  function* genFnChild() {
    try {
      yield io.put({ type: 'startChild' })
      yield io.cps(() => {
        throw new Error('child error')
        //cb(null, "Ok")
      })
      yield io.put({ type: 'success child' })
    } catch (e) {
      yield io.put({ type: 'failure child' })
    }
  }

  function* genFnParent() {
    yield io.fork(function*() {
      while (true) {
        const action = yield io.take('*')
        actual.push(action.type)
      }
    })
    try {
      yield io.put({ type: 'start parent' })
      yield genFnChild()
      yield io.put({ type: 'success parent' })
    } catch (e) {
      yield io.put({ type: 'failure parent' })
    }
  }

  runSaga({}, genFnParent)

  const expected = ['start parent', 'startChild', 'failure child', 'success parent']

  expect(actual).toEqual(expected)
})

test('saga cps cancellation handling', () => {
  let cancelled = false
  const cpsFn = cb => {
    cb.cancel = () => {
      cancelled = true
    }
  }

  const task = runSaga({}, function* genFn() {
    const task = yield io.fork(function*() {
      yield io.cps(cpsFn)
    })
    yield io.cancel(task)
  })

  return task.toPromise().then(() => {
    // saga should call cancellation function on callback
    expect(cancelled).toBe(true)
  })
})
