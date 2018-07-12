import { SAGA_ACTION, runSaga, deferred, delay, io, END } from '../../src'

test('saga parallel effects handling', () => {
  let actual
  const def = deferred()
  let cpsCb = {}
  const cps = (val, cb) => (cpsCb = { val, cb })

  const expected = [1, 2, { [SAGA_ACTION]: true, type: 'action' }]

  return runSaga({}, function* genFn() {
    const { all, take, fork, put } = io
    yield fork(logicAfterDelay0)
    actual = yield all([def.promise, io.cps(cps, 2), take('action')])

    function* logicAfterDelay0() {
      yield delay(0)
      def.resolve(1)
      cpsCb.cb(null, cpsCb.val)
      yield put({ type: 'action' })
    }
  })
    .toPromise()
    .then(() => {
      // saga must fulfill parallel effects
      expect(actual).toEqual(expected)
    })
})

test('saga empty array', () => {
  let actual

  return runSaga({}, function*() {
    actual = yield io.all([])
  })
    .toPromise()
    .then(() => {
      // saga must fulfill empty parallel effects with an empty array
      expect(actual).toEqual([])
    })
})

test('saga parallel effect: handling errors', () => {
  let actual
  const def1 = deferred()
  const def2 = deferred()

  return runSaga({}, function*() {
    yield io.fork(logicAfterDelay0)
    try {
      actual = yield io.all([def1.promise, def2.promise])
    } catch (err) {
      actual = [err]
    }

    function* logicAfterDelay0() {
      yield delay(0)
      def1.reject('error')
      def2.resolve(1)
    }
  })
    .toPromise()
    .then(() => {
      // saga must catch the first error in parallel effects
      expect(actual).toEqual(['error'])
    })
})

test('saga parallel effect: handling END', () => {
  let actual
  const def = deferred()

  return runSaga({}, function*() {
    yield io.fork(logicAfterDelay0)
    try {
      actual = yield io.all([def.promise, io.take('action')])
    } finally {
      actual = 'end'
    }

    function* logicAfterDelay0() {
      yield delay(0)
      def.resolve(1)
      yield io.put(END)
    }
  })
    .toPromise()
    .then(() => {
      // saga must end Parallel Effect if one of the effects resolve with END'
      expect(actual).toBe('end')
    })
})

test('saga parallel effect: named effects', () => {
  let actual
  const def = deferred()

  return runSaga({}, function*() {
    yield io.fork(logicAfterDelay0)
    actual = yield io.all({
      ac: io.take('action'),
      prom: def.promise,
    })
    function* logicAfterDelay0() {
      yield delay(0)
      def.resolve(1)
      yield io.put({ type: 'action' })
    }
  })
    .toPromise()
    .then(() => {
      expect(actual).toEqual({
        ac: { [SAGA_ACTION]: true, type: 'action' },
        prom: 1,
      })
    })
})
