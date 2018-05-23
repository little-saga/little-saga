import { env, deferred, noop, io } from '../../src'
import commonEffects from '../../src/commonEffects'
import channelEffects from '../../src/channelEffects'
import { END } from '../../src/channelEffects/channel'

const run = fn =>
  env(noop)
    .use(commonEffects)
    .use(channelEffects)
    .run(fn)

test('saga parallel effects handling', () => {
  let actual
  const def = deferred()

  const expected = [1, { type: 'action' }]

  return run(function* genFn() {
    const { all, take, fork, put, delay } = io
    yield fork(logicAfterDelay0)
    actual = yield all([def.promise, /* TODO ??cps?? */ take('action')])

    function* logicAfterDelay0() {
      yield delay(0)
      def.resolve(1)
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

  return run(function*() {
    actual = yield ['all', []]
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

  return run(function*() {
    yield ['fork', logicAfterDelay0]
    try {
      actual = yield ['all', [def1.promise, def2.promise]]
    } catch (err) {
      actual = [err]
    }

    function* logicAfterDelay0() {
      yield ['delay', 0]
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

  return run(function*() {
    const { all, take, put, fork, delay } = io
    yield fork(logicAfterDelay0)
    try {
      actual = yield all([def.promise, take('action')])
    } finally {
      actual = 'end'
    }

    function* logicAfterDelay0() {
      yield delay(0)
      def.resolve(1)
      yield put(END)
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

  return run(function*() {
    const { all, take, put, fork } = io
    yield fork(logicAfterDelay0)
    actual = yield all({
      ac: take('action'),
      prom: def.promise,
    })
    function* logicAfterDelay0() {
      yield ['delay', 0]
      def.resolve(1)
      yield put({ type: 'action' })
    }
  })
    .toPromise()
    .then(() => {
      expect(actual).toEqual({ ac: { type: 'action' }, prom: 1 })
    })
})
