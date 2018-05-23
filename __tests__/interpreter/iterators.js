import { deferred, env, io, noop } from '../../src'
import commonEffects from '../../src/commonEffects'
import channelEffects from '../../src/channelEffects'

test('saga nested iterator handling', () => {
  const actual = []
  let dispatch
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

  const task = env(noop)
    .use(commonEffects)
    .use(channelEffects)
    .use(ctx => (dispatch = ctx.channel.put))
    .run(main)

  Promise.resolve(1)
    .then(() => def1.resolve(1))
    .then(() => dispatch({ type: 'action-1' }))
    .then(() => def2.resolve(2))
    .then(() => dispatch({ type: 'action-2' }))
    .then(() => def3.resolve(3))
    .then(() => dispatch({ type: 'action-3' }))

  return task.toPromise().then(() => {
    // saga must fullfill nested iterator effects
    expect(actual).toEqual(expected)
  })
})
