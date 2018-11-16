import EventEmitter from 'events'
import { buffers, channel, END, io, runSaga, stdChannel, takeEvery, makeScheduler } from '../../src'

test('synchronous sequential takes', () => {
  const actual = []
  let dispatch

  function* fnA() {
    actual.push(yield io.take('a1'))
    actual.push(yield io.take('a3'))
  }

  function* fnB() {
    actual.push(yield io.take('a2'))
  }

  const scheduler = makeScheduler()
  const channel = stdChannel(scheduler).enhancePut(put => (dispatch = put))

  runSaga({ scheduler, channel }, function*() {
    yield io.fork(fnA)
    yield io.fork(fnB)
  })

  dispatch({ type: 'a1' })
  dispatch({ type: 'a2' })
  dispatch({ type: 'a3' })

  const expected = [{ type: 'a1' }, { type: 'a2' }, { type: 'a3' }]
  expect(actual).toEqual(expected)
})

test('synchronous concurrent takes', () => {
  const actual = []

  const scheduler = makeScheduler()
  const channel = stdChannel(scheduler)

  runSaga({ scheduler, channel }, function* root() {
    // If a1 wins, then a2 cancellation means
    // it will not take the next 'a2' action,
    // dispatched immediately by the store after 'a1';
    // so the 2n take('a2') should take it
    actual.push(
      yield io.race({
        a1: io.take('a1'),
        a2: io.take('a2'),
      }),
    )

    actual.push(yield io.take('a2'))
  })

  channel.put({ type: 'a1' })
  channel.put({ type: 'a2' })

  const expected = [{ a1: { type: 'a1' } }, { type: 'a2' }]
  // In concurrent takes only the winner must take an action
  expect(actual).toEqual(expected)
})

test('synchronous parallel takes', () => {
  const actual = []

  const scheduler = makeScheduler()
  const channel = stdChannel(scheduler)

  runSaga({ scheduler, channel }, function* root() {
    actual.push(yield io.all([io.take('a1'), io.take('a2')]))
  })

  channel.put({ type: 'a1' })
  channel.put({ type: 'a2' })

  const expected = [[{ type: 'a1' }, { type: 'a2' }]]
  // Saga must resolve once all parallel actions dispatched
  expect(actual).toEqual(expected)
})

test('synchronous parallel + concurrent takes', () => {
  const actual = []
  const scheduler = makeScheduler()
  const channel = stdChannel(scheduler)

  runSaga({ scheduler, channel }, function* root() {
    actual.push(
      yield io.all([
        io.race({
          a1: io.take('a1'),
          a2: io.take('a2'),
        }),
        io.take('a2'),
      ]),
    )
  })

  channel.put({ type: 'a1' })
  channel.put({ type: 'a2' })

  const expected = [[{ a1: { type: 'a1' } }, { type: 'a2' }]]
  // Saga must resolve once all parallel actions dispatched
  expect(actual).toEqual(expected)
})

test('synchronous takes + puts', () => {
  const actual = []

  const scheduler = makeScheduler()
  const channel = stdChannel(scheduler)

  runSaga({ scheduler, channel }, function* root() {
    yield io.fork(function*() {
      while (true) {
        const action = yield io.take('a')
        actual.push(action.payload)
      }
    })
    yield io.take('a')
    yield io.put({ type: 'a', payload: 'ack-1' })
    yield io.take('a')
    yield io.put({ type: 'a', payload: 'ack-2' })
  })

  channel.put({ type: 'a', payload: 1 })
  channel.put({ type: 'a', payload: 2 })

  // Sagas must be able to interleave takes and puts without losing actions
  expect(actual).toEqual([1, 'ack-1', 2, 'ack-2'])
})

test('synchronous takes (from a channel) + puts (to the store)', () => {
  const actual = []
  const chan = channel()

  runSaga({}, function* root() {
    yield io.fork(function*() {
      while (true) {
        const action = yield io.take('a')
        actual.push(action.payload)
      }
    })
    actual.push((yield io.take(chan, 'a')).payload)
    yield io.put({ type: 'a', payload: 'ack-1' })
    actual.push((yield io.take(chan, 'a')).payload)
    yield io.put({ type: 'a', payload: 'ack-2' })
    actual.push(yield io.take('never-happening-action'))
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
      let { payload } = yield io.take('a')
      yield io.fork(someAction, payload)
    }
  }

  function* fnB() {
    yield io.put({ type: 'a', payload: 1 })
    yield io.put({ type: 'a', payload: 2 })
    yield io.put({ type: 'a', payload: 3 })
  }

  function* someAction(payload) {
    actual.push(payload)
  }
  runSaga({}, function* root() {
    yield io.all([io.fork(fnA), io.fork(fnB)])
  })

  // Sagas must take actions from each other
  expect(actual).toEqual([1, 2, 3])
})

test('inter-saga put/take handling (via buffered channel)', async () => {
  const actual = []
  const chan = channel()

  function* fnA() {
    while (true) {
      let action = yield io.take(chan)
      yield io.call(someAction, action)
    }
  }

  function* fnB() {
    yield io.put(chan, 1)
    yield io.put(chan, 2)
    yield io.put(chan, 3)
    yield io.call(chan.close)
  }

  function* someAction(action) {
    actual.push(action)
    yield Promise.resolve()
  }

  function* root() {
    yield io.all([io.fork(fnA), io.fork(fnB)])
  }

  await runSaga({}, root).toPromise()
  // Sagas must take actions from each other (via buffered channel)
  expect(actual).toEqual([1, 2, 3])
})

test('inter-saga send/aknowledge handling', () => {
  const actual = []
  const push = ({ type }) => actual.push(type)

  function* fnA() {
    push(yield io.take('msg-1'))
    yield io.put({ type: 'ack-1' })
    push(yield io.take('msg-2'))
    yield io.put({ type: 'ack-2' })
  }

  function* fnB() {
    yield io.put({ type: 'msg-1' })
    push(yield io.take('ack-1'))
    yield io.put({ type: 'msg-2' })
    push(yield io.take('ack-2'))
  }

  function* root() {
    yield io.all([io.fork(fnA), io.fork(fnB)])
  }

  runSaga({}, root)

  // Sagas must take actions from each other in the right order
  expect(actual).toEqual(['msg-1', 'ack-1', 'msg-2', 'ack-2'])
})

test('inter-saga send/acknowledge handling (via unbuffered channel)', () => {
  const actual = []
  // non buffered channel must behave like the store
  const chan = channel(buffers.none())

  function* fnA() {
    actual.push(yield io.take(chan))
    yield io.put(chan, 'ack-1')
    actual.push(yield io.take(chan))
    yield io.put(chan, 'ack-2')
  }

  function* fnB() {
    yield io.put(chan, 'msg-1')
    actual.push(yield io.take(chan))
    yield io.put(chan, 'msg-2')
    actual.push(yield io.take(chan))
  }

  function* root() {
    yield io.fork(fnA)
    yield io.fork(fnB)
  }

  runSaga({}, root)

  // Sagas must take actions from each other (via unbuffered channel) in the right order
  expect(actual).toEqual(['msg-1', 'ack-1', 'msg-2', 'ack-2'])
})

test('inter-saga send/acknowledge handling (via buffered channel)', () => {
  const actual = []
  const chan = channel()

  function* fnA() {
    actual.push(yield io.take(chan))

    yield io.put(chan, 'ack-1')
    yield Promise.resolve()

    actual.push(yield io.take(chan))
    yield io.put(chan, 'ack-2')
  }

  function* fnB() {
    yield io.put(chan, 'msg-1')
    yield Promise.resolve()

    actual.push(yield io.take(chan))

    yield io.put(chan, 'msg-2')
    yield Promise.resolve()

    actual.push(yield io.take(chan))
  }

  function* root() {
    yield io.fork(fnB)
    yield io.fork(fnA)
  }

  return runSaga({}, root)
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
    yield io.all([takeEvery('TEST', takeTest1), takeEvery('TEST2', takeTest2)])
  }

  function* takeTest1(action) {
    if (testCounter === 0) {
      actual.push(1)
      testCounter++

      yield io.put({ type: 'TEST2' })
    } else {
      actual.push(++testCounter)
    }
  }

  function* takeTest2(action) {
    yield io.all([io.fork(forkedPut1), io.fork(forkedPut2)])
  }

  function* forkedPut1() {
    yield io.put({ type: 'TEST' })
  }

  function* forkedPut2() {
    yield io.put({ type: 'TEST' })
  }

  const emitter = new EventEmitter()
  const scheduler = makeScheduler()
  const channel = stdChannel(scheduler)
  emitter.on('action', action => channel.put(action))
  const task = runSaga(
    { scheduler, channel, dispatch: action => emitter.emit('action', action) },
    root,
  )

  emitter.emit('action', { type: 'TEST' })
  emitter.emit('action', END)

  await task.toPromise()

  // Sagas must take actions from each forked childs doing Sync puts
  expect(actual).toEqual([1, 2, 3])
})

test('deeply nested forks/puts', () => {
  const actual = []

  function* s1() {
    yield io.fork(s2)
    actual.push((yield io.take('a2')).type)
  }

  function* s2() {
    yield io.fork(s3)
    actual.push((yield io.take('a3')).type)
    yield io.put({ type: 'a2' })
  }

  function* s3() {
    yield io.put({ type: 'a3' })
  }

  runSaga({}, s1)

  expect(actual).toEqual(['a3', 'a2'])
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
      yield io.put({ type: 'PING', val: action.val + 1 })
      yield io.take(`ACK-${action.val + 1}`)
    }
    yield io.put({ type: `ACK-${action.val}` })
    actual.push(1)
  }

  const emitter = new EventEmitter()
  const scheduler = makeScheduler()
  const channel = stdChannel(scheduler)
  emitter.on('action', action => channel.put(action))
  const task = runSaga(
    {
      scheduler,
      channel,
      dispatch: action => emitter.emit('action', action),
    },
    root,
  )

  emitter.emit('action', { type: 'PING', val: 0 })
  emitter.emit('action', END)

  await task.toPromise()

  // Sagas must take actions from each forked children doing Sync puts
  expect(actual).toEqual([1, 1])
})

test('put causing sync dispatch response in store subscriber', () => {
  const actual = []
  const emitter = new EventEmitter()
  const scheduler = makeScheduler()
  const channel = stdChannel(scheduler).enhancePut(rawPut => {
    emitter.on('action', rawPut)
    return action => emitter.emit('action', action)
  })

  runSaga({ scheduler, channel }, function* root() {
    while (true) {
      const { a, b } = yield io.race({
        a: io.take('a'),
        b: io.take('b'),
      })

      actual.push(a ? a.type : b.type)

      if (a) {
        yield io.put({ type: 'c', test: true })
        continue
      }

      yield io.put({ type: 'd', test: true })
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
