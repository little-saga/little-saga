import { Env, io, noop } from '../../src'
import commonEffects from '../../src/commonEffects'

test('saga must handle context in dynamic scoping manner', () => {
  let actual = []
  const task = new Env(noop)
    .use(commonEffects)
    .use(ctx => {
      ctx.a = 1
    })
    .run(function* genFn() {
      const { fork, getContext, setContext } = io
      actual.push(yield getContext('a'))
      yield setContext({ b: 2 })
      yield fork(function*() {
        actual.push(yield getContext('a'))
        actual.push(yield getContext('b'))
        yield setContext({ c: 3 })
        actual.push(yield getContext('c'))
      })
      actual.push(yield getContext('c'))
    })

  const expected = [1, 1, 2, 3, undefined]

  return task.toPromise().then(() => {
    expect(actual).toEqual(expected)
  })
})
