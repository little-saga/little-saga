import { env, io, noop } from '../../src'
import commonEffects from '../../src/commonEffects'
import channelEffects, { END, channel } from '../../src/channelEffects'

test('saga take from default channel', () => {
  const typeSymbol = Symbol('action-symbol')
  let dispatch

  let actual = []

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

  const task = env(noop)
    .use(commonEffects)
    .use(channelEffects)
    .use(ctx => (dispatch = ctx.channel.put))
    .run(genFn)

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
    .then(() => dispatch({ type: 'action-*' }))
    .then(() => dispatch({ type: 'action-1' }))
    .then(() => dispatch({ type: 'action-2' }))
    .then(() => dispatch({ type: 'unnoticeable-action' }))
    .then(() => dispatch({ type: '', isAction: true }))
    .then(() => dispatch({ type: '', isMixedWithPredicate: true }))
    .then(() => dispatch({ type: 'action-3' }))
    .then(() => dispatch({ type: typeSymbol }))
    .then(() => dispatch(END))

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

  const task = env(noop)
    .use(commonEffects)
    .use(channelEffects)
    .run(genFn)

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
