import EventEmitter from 'events'
import { Env, io, noop } from '../../src'
import commonEffects from '../../src/commonEffects'
import channelEffects, { buffers, channel, connectToEmitter, END } from '../../src/channelEffects'
import { takeEvery } from '../../src/sagaHelpers'

const { call, take, fork, all, put, race } = io

test('synchronous sequential takes', () => {
  const actual = []
  let dispatch

  function* fnA() {
    actual.push(yield take('a1'))
    actual.push(yield take('a3'))
  }

  function* fnB() {
    actual.push(yield take('a2'))
  }

  new Env(noop)
    .use(commonEffects)
    .use(channelEffects)
    .use(ctx => (dispatch = ctx.channel.put))
    .run(function* root() {
      yield fork(fnA)
      yield fork(fnB)
    })

  dispatch({ type: 'a1' })
  dispatch({ type: 'a2' })
  dispatch({ type: 'a3' })

  const expected = [{ type: 'a1' }, { type: 'a2' }, { type: 'a3' }]
  expect(actual).toEqual(expected)
})

test('synchronous concurrent takes', () => {
  const actual = []
  let dispatch

  new Env(noop)
    .use(commonEffects)
    .use(channelEffects)
    .use(ctx => (dispatch = ctx.channel.put))
    .run(function* root() {
      // If a1 wins, then a2 cancellation means
      // it will not take the next 'a2' action,
      // dispatched immediately by the store after 'a1';
      // so the 2n take('a2') should take it
      actual.push(
        yield race({
          a1: take('a1'),
          a2: take('a2'),
        }),
      )

      actual.push(yield take('a2'))
    })

  dispatch({ type: 'a1' })
  dispatch({ type: 'a2' })

  const expected = [{ a1: { type: 'a1' } }, { type: 'a2' }]
  // In concurrent takes only the winner must take an action
  expect(actual).toEqual(expected)
})

test('synchronous parallel takes', () => {
  const actual = []
  let dispatch

  new Env(noop)
    .use(commonEffects)
    .use(channelEffects)
    .use(ctx => (dispatch = ctx.channel.put))
    .run(function* root() {
      actual.push(yield all([take('a1'), take('a2')]))
    })

  dispatch({ type: 'a1' })
  dispatch({ type: 'a2' })

  const expected = [[{ type: 'a1' }, { type: 'a2' }]]
  // Saga must resolve once all parallel actions dispatched
  expect(actual).toEqual(expected)
})

test('synchronous parallel + concurrent takes', () => {
  const actual = []
  let dispatch

  new Env(noop)
    .use(commonEffects)
    .use(channelEffects)
    .use(ctx => (dispatch = ctx.channel.put))
    .run(function* root() {
      actual.push(
        yield all([
          race({
            a1: take('a1'),
            a2: take('a2'),
          }),
          take('a2'),
        ]),
      )
    })

  dispatch({ type: 'a1' })
  dispatch({ type: 'a2' })

  const expected = [[{ a1: { type: 'a1' } }, { type: 'a2' }]]
  // Saga must resolve once all parallel actions dispatched
  expect(actual).toEqual(expected)
})

test('synchronous takes + puts', () => {
  const actual = []
  let dispatch

  new Env(noop)
    .use(commonEffects)
    .use(channelEffects)
    .use(ctx => (dispatch = ctx.channel.put))
    .use(ctx => {
      ctx.channel.take(function taker(action) {
        if (action.type === 'a') {
          actual.push(action.payload)
        }
        ctx.channel.take(taker)
      })
    })
    .run(function* root() {
      yield take('a')
      yield put({ type: 'a', payload: 'ack-1' })
      yield take('a')
      yield put({ type: 'a', payload: 'ack-2' })
    })

  dispatch({ type: 'a', payload: 1 })
  dispatch({ type: 'a', payload: 2 })

  // Sagas must be able to interleave takes and puts without losing actions
  expect(actual).toEqual([1, 'ack-1', 2, 'ack-2'])
})

test('synchronous takes (from a channel) + puts (to the store)', () => {
  const actual = []
  const chan = channel()
  let dispatch

  new Env(noop)
    .use(commonEffects)
    .use(channelEffects)
    .use(ctx => (dispatch = ctx.channel.put))
    .use(ctx => {
      ctx.channel.take(function taker(action) {
        if (action.type === 'a') {
          actual.push(action.payload)
        }
        ctx.channel.take(taker)
      })
    })
    .run(function* root() {
      actual.push((yield take(chan, 'a')).payload)
      yield put({ type: 'a', payload: 'ack-1' })
      actual.push((yield take(chan, 'a')).payload)
      yield put({ type: 'a', payload: 'ack-2' })
      yield take('never-happenning-action')
    })

  chan.put({ type: 'a', payload: 1 })
  chan.put({ type: 'a', payload: 2 })
  chan.close()

  // Sagas must be able to interleave takes (from a channel)
  // and puts (to the store) without losing actions
  expect(actual).toEqual([1, 'ack-1', 2, 'ack-2'])
})

test('inter-saga put/take handling', () => {
  const actual = []

  function* fnA() {
    while (true) {
      let { payload } = yield take('a')
      yield fork(someAction, payload)
    }
  }

  function* fnB() {
    yield put({ type: 'a', payload: 1 })
    yield put({ type: 'a', payload: 2 })
    yield put({ type: 'a', payload: 3 })
  }

  function* someAction(payload) {
    actual.push(payload)
  }
  new Env(noop)
    .use(commonEffects)
    .use(channelEffects)
    .run(function* root() {
      yield all([fork(fnA), fork(fnB)])
    })

  // Sagas must take actions from each other
  expect(actual).toEqual([1, 2, 3])
})

test('inter-saga put/take handling (via buffered channel)', () => {
  const actual = []
  const chan = channel()

  function* fnA() {
    while (true) {
      let action = yield take(chan)
      yield call(someAction, action)
    }
  }

  function* fnB() {
    yield put(chan, 1)
    yield put(chan, 2)
    yield put(chan, 3)
    yield call(chan.close)
  }

  function* someAction(action) {
    actual.push(action)
    yield Promise.resolve()
  }

  function* root() {
    yield all([fork(fnA), fork(fnB)])
  }

  return new Env(noop)
    .use(commonEffects)
    .use(channelEffects)
    .run(root)
    .toPromise()
    .then(() => {
      // Sagas must take actions from each other (via buffered channel)
      expect(actual).toEqual([1, 2, 3])
    })
})

test('inter-saga send/aknowledge handling', () => {
  const actual = []
  const push = ({ type }) => actual.push(type)

  function* fnA() {
    push(yield take('msg-1'))
    yield put({ type: 'ack-1' })
    push(yield take('msg-2'))
    yield put({ type: 'ack-2' })
  }

  function* fnB() {
    yield put({ type: 'msg-1' })
    push(yield take('ack-1'))
    yield put({ type: 'msg-2' })
    push(yield take('ack-2'))
  }

  function* root() {
    yield all([fork(fnA), fork(fnB)])
  }

  new Env(noop)
    .use(commonEffects)
    .use(channelEffects)
    .run(root)

  // Sagas must take actions from each other in the right order
  expect(actual).toEqual(['msg-1', 'ack-1', 'msg-2', 'ack-2'])
})

test('inter-saga send/acknowledge handling (via unbuffered channel)', () => {
  const actual = []
  // non buffered channel must behave like the store
  const chan = channel(buffers.none())

  function* fnA() {
    actual.push(yield take(chan))
    yield put(chan, 'ack-1')
    actual.push(yield take(chan))
    yield put(chan, 'ack-2')
  }

  function* fnB() {
    yield put(chan, 'msg-1')
    actual.push(yield take(chan))
    yield put(chan, 'msg-2')
    actual.push(yield take(chan))
  }

  function* root() {
    yield fork(fnA)
    yield fork(fnB)
  }

  new Env(noop)
    .use(commonEffects)
    .use(channelEffects)
    .run(root)

  // Sagas must take actions from each other (via unbuffered channel) in the right order
  expect(actual).toEqual(['msg-1', 'ack-1', 'msg-2', 'ack-2'])
})

test('inter-saga send/acknowledge handling (via buffered channel)', () => {
  const actual = []
  const chan = channel()

  function* fnA() {
    actual.push(yield take(chan))

    yield put(chan, 'ack-1')
    yield Promise.resolve()

    actual.push(yield take(chan))
    yield put(chan, 'ack-2')
  }

  function* fnB() {
    yield put(chan, 'msg-1')
    yield Promise.resolve()

    actual.push(yield take(chan))

    yield put(chan, 'msg-2')
    yield Promise.resolve()

    actual.push(yield take(chan))
  }

  function* root() {
    yield fork(fnB)
    yield fork(fnA)
  }

  return new Env(noop)
    .use(commonEffects)
    .use(channelEffects)
    .run(root)
    .toPromise()
    .then(() => {
      // Sagas must take actions from each other (via buffered channel) in the right order
      expect(actual).toEqual(['msg-1', 'ack-1', 'msg-2', 'ack-2'])
    })
})

test('inter-saga fork/take back from forked child 1', async () => {
  const actual = []
  let testCounter = 0

  function* root() {
    yield all([takeEvery('TEST', takeTest1), takeEvery('TEST2', takeTest2)])
  }

  function* takeTest1(action) {
    if (testCounter === 0) {
      actual.push(1)
      testCounter++

      yield put({ type: 'TEST2' })
    } else {
      actual.push(++testCounter)
    }
  }

  function* takeTest2(action) {
    yield all([fork(forkedPut1), fork(forkedPut2)])
  }

  function* forkedPut1() {
    yield put({ type: 'TEST' })
  }

  function* forkedPut2() {
    yield put({ type: 'TEST' })
  }

  const emitter = new EventEmitter()
  const task = new Env(noop)
    .use(commonEffects)
    .use(channelEffects)
    .use(connectToEmitter(emitter))
    .run(root)

  emitter.emit('action', { type: 'TEST' })
  emitter.emit('action', END)

  await task.toPromise()

  // Sagas must take actions from each forked childs doing Sync puts
  expect(actual).toEqual([1, 2, 3])
})

test('deeply nested forks/puts', () => {
  const actual = []

  function* s1() {
    yield fork(s2)
    actual.push(yield take('a2'))
  }

  function* s2() {
    yield fork(s3)
    actual.push(yield take('a3'))
    yield put({ type: 'a2' })
  }

  function* s3() {
    yield put({ type: 'a3' })
  }

  new Env(noop)
    .use(commonEffects)
    .use(channelEffects)
    .run(s1)

  expect(actual).toEqual([{ type: 'a3' }, { type: 'a2' }])
})

test('inter-saga fork/take back from forked child 3', async () => {
  const actual = []

  let first = true

  function* root() {
    yield takeEvery('PING', ackWorker)
  }

  function* ackWorker(action) {
    if (first) {
      first = false
      yield put({ type: 'PING', val: action.val + 1 })
      yield take(`ACK-${action.val + 1}`)
    }
    yield put({ type: `ACK-${action.val}` })
    actual.push(1)
  }

  const emitter = new EventEmitter()
  const task = new Env(noop)
    .use(commonEffects)
    .use(channelEffects)
    .use(connectToEmitter(emitter))
    .run(root)

  emitter.emit('action', { type: 'PING', val: 0 })
  emitter.emit('action', END)

  await task.toPromise()

  // Sagas must take actions from each forked childs doing Sync puts
  expect(actual).toEqual([1, 1])
})

test('put causing sync dispatch response in store subscriber', () => {
  const actual = []
  const emitter = new EventEmitter()

  new Env(noop)
    .use(commonEffects)
    .use(channelEffects)
    .use(connectToEmitter(emitter))
    .run(function* root() {
      while (true) {
        const { a, b } = yield race({
          a: take('a'),
          b: take('b'),
        })

        actual.push(a ? a.type : b.type)

        if (a) {
          yield put({ type: 'c', test: true })
          continue
        }

        yield put({ type: 'd', test: true })
      }
    })

  let lastType
  emitter.on('action', action => {
    lastType = action.type
  })
  emitter.on('action', () => {
    if (lastType === 'c') {
      emitter.emit('action', { type: 'b', test: true })
    }
  })
  emitter.emit('action', { type: 'a', test: true })

  // Sagas can't miss actions dispatched by store subscribers during put handling
  expect(actual).toEqual(['a', 'b'])
})
