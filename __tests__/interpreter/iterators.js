import { runSaga, deferred, io, stdChannel } from '../../src'

test('saga nested iterator handling', () => {
  const actual = []
  const def1 = deferred()
  const def2 = deferred()
  const def3 = deferred()

  function* child() {
    actual.push(yield def1.promise)
    actual.push(yield io.take('action-1'))

    actual.push(yield def2.promise)
    actual.push(yield io.take('action-2'))

    actual.push(yield def3.promise)
    actual.push(yield io.take('action-3'))

    actual.push(yield Promise.reject('child error'))
  }

  function* main() {
    try {
      yield child()
    } catch (e) {
      actual.push('caught ' + e)
    }
  }
  const expected = [
    1,
    { type: 'action-1' },
    2,
    { type: 'action-2' },
    3,
    { type: 'action-3' },
    'caught child error',
  ]

  const channel = stdChannel()
  const task = runSaga({ channel }, main)

  Promise.resolve(1)
    .then(() => def1.resolve(1))
    .then(() => channel.put({ type: 'action-1' }))
    .then(() => def2.resolve(2))
    .then(() => channel.put({ type: 'action-2' }))
    .then(() => def3.resolve(3))
    .then(() => channel.put({ type: 'action-3' }))

  return task.toPromise().then(() => {
    // saga must fullfill nested iterator effects
    expect(actual).toEqual(expected)
  })
})
