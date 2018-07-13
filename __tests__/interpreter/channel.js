import { buffers, io, runSaga, stdChannel } from '../../src'

test('saga create channel for store actions', () => {
  let actual = []
  let dispatch
  const channel = stdChannel().enhancePut(put => (dispatch = put))

  const task = runSaga({ channel }, function* genFn() {
    const chan = yield io.actionChannel('action')
    for (let i = 0; i < 10; i++) {
      yield Promise.resolve(1)
      const { payload } = yield io.take(chan)
      actual.push(payload)
    }
  })

  for (let i = 0; i < 10; i++) {
    dispatch({ type: 'action', payload: i + 1 })
  }

  const expected = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
  return task.toPromise().then(() => {
    // saga must queue dispatched actions
    expect(actual).toEqual(expected)
  })
})

test('saga create channel for store actions (with buffer)', () => {
  const buffer = buffers.expanding()
  let dispatch

  const task = runSaga(
    { channel: stdChannel().enhancePut(put => (dispatch = put)) },
    function* genFn() {
      return yield io.actionChannel('action', buffer)
    },
  )

  Promise.resolve().then(() => {
    for (let i = 0; i < 10; i++) {
      dispatch({ type: 'action', payload: i + 1 })
    }
  })

  return task.toPromise().then(() => {
    // saga must queue dispatched actions
    const expected = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
    expect(buffer.flush().map(item => item.payload)).toEqual(expected)
  })
})
