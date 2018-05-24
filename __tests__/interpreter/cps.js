import { io, Env, noop } from '../../src'
import commonEffects from '../../src/commonEffects'
import channelEffects from '../../src/channelEffects'

test('saga cps call handling', () => {
  let actual = []

  const task = new Env(noop)
    .use(commonEffects)
    .use(ctx => {
      ctx.a = 1
    })
    .run(function* genFn() {
      const { cps } = io
      try {
        yield cps(cb => {
          actual.push('call 1')
          cb('err')
        })
        actual.push('call 2')
      } catch (err) {
        actual.push('call ' + err)
      }
    })

  const expected = ['call 1', 'call err']

  return task.toPromise().then(() => {
    // saga must fulfill cps call effects
    expect(actual).toEqual(expected)
  })
})

test('saga synchronous cps failures handling', () => {
  let actual = []

  function* genFnChild() {
    try {
      yield io.put({ type: 'startChild' })
      yield io.cps(() => {
        throw new Error('child error')
        //cb(null, "Ok")
      })
      yield io.put({ type: 'success child' })
    } catch (e) {
      yield io.put({ type: 'failure child' })
    }
  }

  function* genFnParent() {
    try {
      yield io.put({ type: 'start parent' })
      yield genFnChild()
      yield io.put({ type: 'success parent' })
    } catch (e) {
      yield io.put({ type: 'failure parent' })
    }
  }

  const task = new Env(noop)
    .use(commonEffects)
    .use(channelEffects)
    .use(ctx => {
      ctx.channel.take(function taker(payload) {
        actual.push(payload.type)
        ctx.channel.take(taker)
      })
    })
    .run(genFnParent)

  const expected = ['start parent', 'startChild', 'failure child', 'success parent']

  return task.toPromise().then(() => {
    // saga should inject call error into generator
    expect(actual).toEqual(expected)
  })
})

test('saga cps cancellation handling', () => {
  let cancelled = false
  const cpsFn = cb => {
    cb.cancel = () => {
      cancelled = true
    }
  }

  const task = new Env(noop).use(commonEffects).run(function* genFn() {
    const task = yield io.fork(function*() {
      yield io.cps(cpsFn)
    })
    yield io.cancel(task)
  })

  return task.toPromise().then(() => {
    // saga should call cancellation function on callback
    expect(cancelled).toBe(true)
  })
})
