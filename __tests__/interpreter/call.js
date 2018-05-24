import { Env, noop, io } from '../../src'
import commonEffects from '../../src/commonEffects'
import channelEffects from '../../src/channelEffects'

const simpleRun = fn =>
  new Env(noop)
    .use(commonEffects)
    .use(channelEffects)
    .run(fn)

function fail(message) {
  throw new Error(message)
}

test('saga handles call effects and resume with the resolved values', () => {
  let actual = []

  class C {
    constructor(val) {
      this.val = val
    }

    method() {
      return Promise.resolve(this.val)
    }
  }

  const inst1 = new C(1)
  const inst2 = new C(2)
  const inst3 = new C(3)
  const inst4 = new C(4)

  function* subGen(io, arg) {
    yield Promise.resolve(null)
    return arg
  }

  const task = simpleRun(function* genFn() {
    actual.push(yield io.call([inst1, inst1.method]))
    actual.push(yield io.call([inst2, 'method']))
    actual.push(yield io.apply(inst3, inst3.method))
    actual.push(yield io.apply(inst4, 'method'))
    actual.push(yield io.call(subGen, io, 5))
  })

  const expected = [1, 2, 3, 4, 5]

  return task.toPromise().then(() => {
    // saga must fullfill declarative call effects
    expect(actual).toEqual(expected)
  })
})

test('saga handles call effects and throw the rejected values inside the generator', () => {
  let actual = []

  function fail(msg) {
    return Promise.reject(msg)
  }

  function* genFnParent() {
    try {
      yield io.put({ type: 'start' })
      yield io.call(fail, 'failure')
      yield io.put({ type: 'success' })
    } catch (e) {
      yield io.put({ type: e })
    }
  }

  const expected = ['start', 'failure']

  return new Env(noop)
    .use(commonEffects)
    .use(channelEffects)
    .use(ctx => {
      ctx.channel.take(function taker(payload) {
        actual.push(payload.type)
        ctx.channel.take(taker)
      })
    })
    .run(genFnParent)
    .toPromise()
    .then(() => {
      // saga dispatches appropriate actions
      expect(actual).toEqual(expected)
    })
})

test("saga handles call's synchronous failures and throws in the calling generator (1)", () => {
  let actual = []

  function* genFnChild() {
    try {
      yield io.put({ type: 'startChild' })
      yield io.call(fail, 'child error')
      yield io.put({ type: 'success child' })
    } catch (e) {
      yield io.put({ type: 'failure child' })
    }
  }

  function* genFnParent() {
    try {
      yield io.put({ type: 'start parent' })
      yield io.call(genFnChild)
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
    // saga dispatches appropriate actions
    expect(actual).toEqual(expected)
  })
})

test("saga handles call's synchronous failures and throws in the calling generator (2)", () => {
  let actual = []

  function* genFnChild() {
    throw 'child error'
  }

  function* genFnParent() {
    try {
      yield io.put({ type: 'start parent' })
      yield io.call(genFnChild)
      yield io.put({ type: 'success parent' })
    } catch (e) {
      yield io.put({ type: e })
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

  const expected = ['start parent', 'child error', 'failure parent']

  return task.toPromise().then(() => {
    // saga should bubble synchronous call errors parent
    expect(actual).toEqual(expected)
  })
})
