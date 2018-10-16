import { io, runSaga } from '../../src'

test('saga must handle context in dynamic scoping manner', () => {
  let actual = []
  const task = runSaga(
    {
      taskContext: { a: 1 },
    },
    function* genFn() {
      actual.push(yield io.getContext('a'))
      yield io.setContext('b', 2)
      yield io.fork(function*() {
        actual.push(yield io.getContext('a'))
        actual.push(yield io.getContext('b'))
        yield io.setContext('c', 3)
        actual.push(yield io.getContext('c'))
      })
      actual.push(yield io.getContext('c'))
    },
  )

  const expected = [1, 1, 2, 3, undefined]

  return task.toPromise().then(() => {
    expect(actual).toEqual(expected)
  })
})
