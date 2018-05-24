import EventEmitter from 'events'
import { deferred, Env, io, is, noop } from '../../src'
import { connectToEmitter } from '../../src/channelEffects'
import compat, { join } from '../../src/compat'

function goodEnv() {
  return new Env(noop).use(compat)
}

test('saga fork handling: generators', async () => {
  let task1
  let task2

  function* subGen(arg) {
    yield Promise.resolve(1)
    return arg
  }

  class C {
    constructor(val) {
      this.val = val
    }

    *gen() {
      return this.val
    }
  }

  const inst = new C(2)

  function* genFn() {
    task1 = yield io.fork(subGen, 1)
    task2 = yield io.fork([inst, inst.gen])
  }

  const mainTask = goodEnv().run(genFn)

  await mainTask.toPromise()
  // fork result must include the promise of the task result
  expect(is.promise(task1.toPromise())).toBe(true)

  const res1 = await task1.toPromise()
  expect(res1).toBe(1)

  const res2 = await task2.toPromise()
  // fork must also handle generators defined as instance methods
  expect(res2).toBe(2)
})

test('saga join handling : generators', () => {
  let actual = []
  const defs = [deferred(), deferred()]

  function* subGen(arg) {
    yield defs[1].promise // will be resolved after the action-1
    return arg
  }

  function* genFn() {
    const task = yield io.fork(subGen, 1)
    actual.push(yield defs[0].promise)
    actual.push(yield io.take('action-1'))
    actual.push(yield join(task))
  }

  const emitter = new EventEmitter()
  const task = goodEnv()
    .use(connectToEmitter(emitter))
    .run(genFn)

  Promise.resolve(1)
    .then(() => defs[0].resolve(true))
    .then(() => emitter.emit('action', { type: 'action-1' }))
    .then(() => defs[1].resolve(2)) // the result of the fork will be resolved the last
  // saga must not block and miss the 2 precedent effects

  const expected = [true, { type: 'action-1' }, 1]

  return task.toPromise().then(() => {
    // saga must not block on forked tasks, but block on joined tasks
    expect(actual).toEqual(expected)
  })
})

test('saga fork/join handling : functions', () => {
  let actual = []

  const defs = [deferred(), deferred()]

  Promise.resolve(1)
    .then(() => defs[0].resolve(true))
    .then(() => defs[1].resolve(2))

  function api() {
    return defs[1].promise
  }

  function syncFn() {
    return 'sync'
  }

  function* genFn() {
    const task = yield io.fork(api)
    const syncTask = yield io.fork(syncFn)

    actual.push(yield defs[0].promise)
    // TODO 这里和 redux-saga 行为不一致
    const promise = yield join(task)
    actual.push(yield promise)
    actual.push(yield join(syncTask))
  }

  const task = goodEnv().run(genFn)

  const expected = [true, 2, 'sync']

  return task.toPromise().then(() => {
    // saga must not block on forked tasks, but block on joined tasks
    expect(actual).toEqual(expected)
  })
})

test('saga fork wait for attached children', async () => {
  const actual = []

  const rootDef = deferred()
  const childAdef = deferred()
  const childBdef = deferred()
  const defs = [deferred(), deferred(), deferred(), deferred()]

  Promise.resolve()
    .then(childAdef.resolve)
    .then(rootDef.resolve)
    .then(defs[0].resolve)
    .then(childBdef.resolve)
    .then(defs[2].resolve)
    .then(defs[3].resolve)
    .then(defs[1].resolve)

  function* root() {
    yield io.fork(childA)
    yield rootDef.promise
    yield io.fork(childB)
  }

  function* childA() {
    yield io.fork(leaf, 0)
    yield childAdef.promise
    yield io.fork(leaf, 1)
  }

  function* childB() {
    yield io.fork(leaf, 2)
    yield childBdef.promise
    yield io.fork(leaf, 3)
  }

  function* leaf(idx) {
    yield defs[idx].promise
    actual.push(idx)
  }

  const task = goodEnv().run(root)

  await task.toPromise()
  // parent task must wait for all forked tasks before terminating
  expect(actual).toEqual([0, 2, 3, 1])
})

test('saga auto cancel forks on error', async () => {
  const actual = []

  const mainDef = deferred()
  const childAdef = deferred()
  const childBdef = deferred()
  const defs = [deferred(), deferred(), deferred(), deferred()]

  Promise.resolve()
    .then(() => childAdef.resolve('childA resolved'))
    .then(() => defs[0].resolve('leaf 1 resolved'))
    .then(() => childBdef.resolve('childB resolved'))
    .then(() => defs[1].resolve('leaf 2 resolved'))
    .then(() => mainDef.reject('main error'))
    //
    .then(() => defs[2].resolve('leaf 3 resolved'))
    .then(() => defs[3].resolve('leaf 4 resolved'))

  function* root() {
    try {
      actual.push(yield io.call(main))
    } catch (e) {
      actual.push('root caught ' + e)
    }
  }

  function* main() {
    try {
      yield io.fork(childA)
      yield io.fork(childB)
      actual.push(yield mainDef.promise)
    } catch (e) {
      actual.push(e)
      throw e
    } finally {
      if (yield io.cancelled()) actual.push('main cancelled')
    }
  }

  function* childA() {
    try {
      yield io.fork(leaf, 0)
      actual.push(yield childAdef.promise)
      yield io.fork(leaf, 1)
    } finally {
      if (yield io.cancelled()) actual.push('childA cancelled')
    }
  }

  function* childB() {
    try {
      yield io.fork(leaf, 2)
      yield io.fork(leaf, 3)
      actual.push(yield childBdef.promise)
    } finally {
      if (yield io.cancelled()) actual.push('childB cancelled')
    }
  }

  function* leaf(idx) {
    try {
      actual.push(yield defs[idx].promise)
    } finally {
      if (yield io.cancelled()) actual.push(`leaf ${idx + 1} cancelled`)
    }
  }

  const task = goodEnv().run(root)

  const expected = [
    'childA resolved',
    'leaf 1 resolved',
    'childB resolved',
    'leaf 2 resolved',
    'main error',
    'leaf 3 cancelled',
    'leaf 4 cancelled',
    'root caught main error',
  ]

  await task.toPromise()
  expect(actual).toEqual(expected)
  // parent task must cancel all forked tasks when it aborts
})

test('saga auto cancel forks on main cancelled', async () => {
  const actual = []
  const rootDef = deferred()
  const mainDef = deferred()
  const childAdef = deferred()
  const childBdef = deferred()
  const defs = [deferred(), deferred(), deferred(), deferred()]

  Promise.resolve()
    .then(() => childAdef.resolve('childA resolved'))
    .then(() => defs[0].resolve('leaf 1 resolved'))
    .then(() => childBdef.resolve('childB resolved'))
    .then(() => defs[1].resolve('leaf 2 resolved'))
    .then(() => rootDef.resolve('root resolved'))
    .then(() => mainDef.resolve('main resolved'))
    .then(() => defs[2].resolve('leaf 3 resolved'))
    .then(() => defs[3].resolve('leaf 4 resolved'))

  function* root() {
    try {
      const task = yield io.fork(main)
      actual.push(yield rootDef.promise)
      yield io.cancel(task)
    } catch (e) {
      actual.push('root caught ' + e)
    }
  }

  function* main() {
    try {
      yield io.fork(childA)
      yield io.fork(childB)
      actual.push(yield mainDef.promise)
    } finally {
      if (yield io.cancelled()) actual.push('main cancelled')
    }
  }

  function* childA() {
    try {
      yield io.fork(leaf, 0)
      actual.push(yield childAdef.promise)
      yield io.fork(leaf, 1)
    } finally {
      if (yield io.cancelled()) actual.push('childA cancelled')
    }
  }

  function* childB() {
    try {
      yield io.fork(leaf, 2)
      yield io.fork(leaf, 3)
      actual.push(yield childBdef.promise)
    } finally {
      if (yield io.cancelled()) actual.push('childB cancelled')
    }
  }

  function* leaf(idx) {
    try {
      actual.push(yield defs[idx].promise)
    } finally {
      if (yield io.cancelled()) actual.push(`leaf ${idx + 1} cancelled`)
    }
  }

  const task = goodEnv().run(root)

  const expected = [
    'childA resolved',
    'leaf 1 resolved',
    'childB resolved',
    'leaf 2 resolved',
    'root resolved',
    'main cancelled',
    'leaf 3 cancelled',
    'leaf 4 cancelled',
  ]

  await task.toPromise()
  // parent task must cancel all forked tasks when it's cancelled
  expect(actual).toEqual(expected)
})

test('saga auto cancel forks if a child aborts', async () => {
  const actual = []

  const mainDef = deferred()
  const childAdef = deferred()
  const childBdef = deferred()
  const defs = [deferred(), deferred(), deferred(), deferred()]

  Promise.resolve()
    .then(() => childAdef.resolve('childA resolved'))
    .then(() => defs[0].resolve('leaf 1 resolved'))
    .then(() => childBdef.resolve('childB resolved'))
    .then(() => defs[1].resolve('leaf 2 resolved'))
    .then(() => mainDef.resolve('main resolved'))
    .then(() => defs[2].reject('leaf 3 error'))
    .then(() => defs[3].resolve('leaf 4 resolved'))

  function* root() {
    try {
      actual.push(yield io.call(main))
    } catch (e) {
      actual.push('root caught ' + e)
    }
  }

  function* main() {
    try {
      yield io.fork(childA)
      yield io.fork(childB)
      actual.push(yield mainDef.promise)
      return 'main returned'
    } finally {
      if (yield io.cancelled()) actual.push('main cancelled')
    }
  }

  function* childA() {
    try {
      yield io.fork(leaf, 0)
      actual.push(yield childAdef.promise)
      yield io.fork(leaf, 1)
    } finally {
      if (yield io.cancelled()) actual.push('childA cancelled')
    }
  }

  function* childB() {
    try {
      yield io.fork(leaf, 2)
      yield io.fork(leaf, 3)
      actual.push(yield childBdef.promise)
    } finally {
      if (yield io.cancelled()) actual.push('childB cancelled')
    }
  }

  function* leaf(idx) {
    try {
      actual.push(yield defs[idx].promise)
    } catch (e) {
      actual.push(e)
      throw e
    } finally {
      if (yield io.cancelled()) actual.push(`leaf ${idx + 1} cancelled`)
    }
  }

  const task = goodEnv().run(root)

  const expected = [
    'childA resolved',
    'leaf 1 resolved',
    'childB resolved',
    'leaf 2 resolved',
    'main resolved',
    'leaf 3 error',
    'leaf 4 cancelled',
    'root caught leaf 3 error',
  ]

  await task.toPromise()
  // parent task must cancel all forked tasks when it aborts
  expect(actual).toEqual(expected)
})

test('saga auto cancel parent + forks if a child aborts', async () => {
  const actual = []

  const mainDef = deferred()
  const childAdef = deferred()
  const childBdef = deferred()
  const defs = [deferred(), deferred(), deferred(), deferred()]

  Promise.resolve()
    .then(() => childAdef.resolve('childA resolved'))
    .then(() => defs[0].resolve('leaf 1 resolved'))
    .then(() => childBdef.resolve('childB resolved'))
    .then(() => defs[1].resolve('leaf 2 resolved'))
    .then(() => defs[2].reject('leaf 3 error'))
    .then(() => mainDef.resolve('main resolved'))
    .then(() => defs[3].resolve('leaf 4 resolved'))

  function* root() {
    try {
      actual.push(yield io.call(main))
    } catch (e) {
      actual.push('root caught ' + e)
    }
  }

  function* main() {
    try {
      yield io.fork(childA)
      yield io.fork(childB)
      actual.push(yield mainDef.promise)
      return 'main returned'
    } catch (e) {
      actual.push(e)
      throw e
    } finally {
      if (yield io.cancelled()) actual.push('main cancelled')
    }
  }

  function* childA() {
    try {
      yield io.fork(leaf, 0)
      actual.push(yield childAdef.promise)
      yield io.fork(leaf, 1)
    } finally {
      if (yield io.cancelled()) actual.push('childA cancelled')
    }
  }

  function* childB() {
    try {
      yield io.fork(leaf, 2)
      yield io.fork(leaf, 3)
      actual.push(yield childBdef.promise)
    } finally {
      if (yield io.cancelled()) actual.push('childB cancelled')
    }
  }

  function* leaf(idx) {
    try {
      actual.push(yield defs[idx].promise)
    } catch (e) {
      actual.push(e)
      throw e
    } finally {
      if (yield io.cancelled()) actual.push(`leaf ${idx + 1} cancelled`)
    }
  }

  const task = goodEnv().run(root)

  const expected = [
    'childA resolved',
    'leaf 1 resolved',
    'childB resolved',
    'leaf 2 resolved',
    'leaf 3 error',
    'leaf 4 cancelled',
    'main cancelled',
    'root caught leaf 3 error',
  ]

  await task.toPromise()
  // parent task must cancel all forked tasks when it aborts
  expect(actual).toEqual(expected)
})

test('joining multiple tasks', async () => {
  let actual
  const defs = [deferred(), deferred(), deferred()]

  function* worker(i) {
    return yield defs[i].promise
  }

  function* genFn() {
    const task1 = yield io.fork(worker, 0)
    const task2 = yield io.fork(worker, 1)
    const task3 = yield io.fork(worker, 2)

    actual = yield join(task1, task2, task3)
  }

  const mainTask = goodEnv().run(genFn)

  Promise.resolve()
    .then(() => defs[0].resolve(1))
    .then(() => defs[2].resolve(3))
    .then(() => defs[1].resolve(2))

  const expected = [1, 2, 3]

  await mainTask.toPromise()
  // it must be possible to join on multiple tasks
  expect(actual).toEqual(expected)
})
