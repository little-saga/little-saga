import { channel, deferred, END, io, runSaga, stdChannel } from '../../src'

test('saga put handling', () => {
  const actual = []

  const channel = stdChannel().enhancePut(put => action => {
    actual.push(action.type)
    return put(action)
  })

  function* genFn(arg) {
    yield io.put({ type: arg })
    yield io.put({ type: 2 })
  }

  const task = runSaga({ channel }, genFn, 'arg')

  const expected = ['arg', 2]

  return task.toPromise().then(() => {
    expect(actual).toEqual(expected)
  })
})

test('saga put in a channel', () => {
  const buffer = []
  const spyBuffer = {
    isEmpty: () => buffer.length === 0,
    put: it => buffer.push(it),
    take: () => buffer.shift(),
  }
  const chan = channel(spyBuffer)

  function* genFn(arg) {
    yield io.put(chan, arg)
    yield io.put(chan, 2)
  }

  const task = runSaga({}, genFn, 'arg')

  const expected = ['arg', 2]

  return task.toPromise().then(() => {
    expect(buffer).toEqual(expected)
  })
})

test("saga error put's response handling", () => {
  let actual = []
  const error = new Error('error')
  const channel = stdChannel().enhancePut(put => action => {
    if (action.error) {
      throw error
    }
    put(action)
  })

  function* genFn(arg) {
    try {
      yield io.put({ type: arg, error: true })
    } catch (err) {
      actual.push(err)
    }
  }

  const task = runSaga({ channel }, genFn, 'arg')

  const expected = [error]

  return task.toPromise().then(() => {
    expect(actual).toEqual(expected)
  })
})

test('saga nested puts handling', () => {
  let actual = []

  function* genA() {
    yield io.put({ type: 'a' })
    actual.push('put a')
  }

  function* genB() {
    yield io.take('a')
    yield io.put({ type: 'b' })
    actual.push('put b')
  }

  function* root() {
    // forks genB first to be ready to take before genA starts putting
    yield io.fork(genB)
    yield io.fork(genA)
  }

  const expected = ['put a', 'put b']

  return runSaga({}, root)
    .toPromise()
    .then(() => {
      // saga must order nested puts by executing them after the outer puts complete
      expect(actual).toEqual(expected)
    })
})

// TODO test('puts does not trigger stack overflow')

// TODO 与 redux-saga 的测试差别较大
test('puts emitted directly after creating a task (caused by another put) should not be missed by that task', () => {
  const actual = []
  let callSubscriber = false
  let dispatch = false

  const channel = stdChannel().enhancePut(put => {
    dispatch = put
    return action => {
      callSubscriber = action.callSubscriber
      return put(action)
    }
  })

  const saga = runSaga({ channel }, function*() {
    yield io.take('a')
    yield io.put({ type: 'b', callSubscriber: true })
    yield io.take('c')
    yield io.fork(function*() {
      yield io.take('do not miss')
      actual.push("didn't get missed")
    })
  })

  dispatch({ type: 'a' })
  if (callSubscriber) {
    dispatch({ type: 'c' })
    dispatch({ type: 'do not miss' })
  }

  const expected = ["didn't get missed"]

  return saga.toPromise().then(() => {
    expect(actual).toEqual(expected)
  })
})

test('END should reach tasks created after it gets dispatched', () => {
  const actual = []
  let dispatch = false

  const channel = stdChannel().enhancePut(put => (dispatch = put))

  function* subTask() {
    try {
      while (true) {
        actual.push('subTask taking END')
        yield io.take('NEXT')
        actual.push('should not get here')
      }
    } finally {
      actual.push('auto ended')
    }
  }

  const def = deferred()

  const task = runSaga({ channel }, function*() {
    while (true) {
      yield io.take('START')
      actual.push('start taken')
      yield def.promise
      actual.push('non-take effect resolved')
      yield io.fork(subTask)
      actual.push('subTask forked')
    }
  })

  dispatch({ type: 'START' })
  dispatch(END)

  def.resolve()
  dispatch({ type: 'NEXT' })
  dispatch({ type: 'START' })

  const expected = [
    'start taken',
    'non-take effect resolved',
    'subTask taking END',
    'auto ended',
    'subTask forked',
  ]

  return task.toPromise().then(() => {
    expect(actual).toEqual(expected)
  })
})
