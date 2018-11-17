import { channel, END, io, runSaga, stdChannel } from '../../src'

test('saga take from default channel', () => {
  const typeSymbol = Symbol('action-symbol')
  const actual = []
  const channel = stdChannel()

  function* genFn() {
    try {
      actual.push(yield io.take()) // take all actions
      actual.push(yield io.take('action-1')) // take only actions of type 'action-1'
      actual.push(yield io.take(['action-2', 'action-2222'])) // take either type
      actual.push(yield io.take(a => a.isAction)) // take if match predicate
      actual.push(yield io.take(['action-3', a => a.isMixedWithPredicate])) // take if match any from the mixed array
      actual.push(yield io.take(['action-3', a => a.isMixedWithPredicate])) // take if match any from the mixed array
      actual.push(yield io.take(typeSymbol)) // take only actions of a Symbol type
      actual.push(yield io.take('never-happening-action')) // should get END
    } finally {
      actual.push('auto ended')
    }
  }

  const task = runSaga({ channel }, genFn)

  const expected = [
    { type: 'action-*' },
    { type: 'action-1' },
    { type: 'action-2' },
    { type: '', isAction: true },
    { type: '', isMixedWithPredicate: true },
    { type: 'action-3' },
    { type: typeSymbol },
    'auto ended',
  ]

  Promise.resolve(1)
    .then(() => channel.put({ type: 'action-*' }))
    .then(() => channel.put({ type: 'action-1' }))
    .then(() => channel.put({ type: 'action-2' }))
    .then(() => channel.put({ type: 'unnoticeable-action' }))
    .then(() => channel.put({ type: '', isAction: true }))
    .then(() => channel.put({ type: '', isMixedWithPredicate: true }))
    .then(() => channel.put({ type: 'action-3' }))
    .then(() => channel.put({ type: typeSymbol }))
    .then(() => channel.put(END))

  return task.toPromise().then(() => {
    expect(actual).toEqual(expected)
  })
})

test('saga take from provided channel', () => {
  const chan = channel()
  let actual = []

  function* genFn() {
    actual.push(yield io.takeMaybe(chan))
    actual.push(yield io.takeMaybe(chan))
    actual.push(yield io.takeMaybe(chan))
    actual.push(yield io.takeMaybe(chan))
    actual.push(yield io.takeMaybe(chan))
    actual.push(yield io.takeMaybe(chan))
  }

  const task = runSaga({}, genFn)

  Promise.resolve()
    .then(() => chan.put(1))
    .then(() => chan.put(2))
    .then(() => chan.put(3))
    .then(() => chan.put(4))
    .then(() => chan.close())

  const expected = [1, 2, 3, 4, END, END]

  return task.toPromise().then(() => {
    expect(actual).toEqual(expected)
  })
})
