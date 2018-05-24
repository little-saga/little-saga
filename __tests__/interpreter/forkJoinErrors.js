import { Env, io, noop } from '../../src'
import commonEffects from '../../src/commonEffects'
import channelEffects from '../../src/channelEffects'

function goodEnv() {
  return new Env(noop).use(commonEffects).use(channelEffects)
}

test('saga sync fork failures: functions', async () => {
  let actual = []

  // NOTE: we'll be forking a function not a Generator
  function immediatelyFailingFork() {
    throw 'immediatelyFailingFork'
  }

  function* genParent() {
    try {
      actual.push('start parent')
      yield io.fork(immediatelyFailingFork)
      actual.push('success parent')
    } catch (e) {
      actual.push('parent caught ' + e)
    }
  }

  function* main() {
    try {
      actual.push('start main')
      yield io.call(genParent)
      actual.push('success main')
    } catch (e) {
      actual.push('main caught ' + e)
    }
  }

  const expected = ['start main', 'start parent', 'main caught immediatelyFailingFork']

  await goodEnv()
    .run(main)
    .toPromise()
  expect(actual).toEqual(expected)
})

test('saga sync fork failures: functions/error bubbling', async () => {
  let actual = []

  // NOTE: we'll be forking a function not a Generator
  function immediatelyFailingFork() {
    throw new Error('immediatelyFailingFork')
  }

  function* genParent() {
    try {
      actual.push('start parent')
      yield io.fork(immediatelyFailingFork)
      actual.push('success parent')
    } catch (e) {
      actual.push('parent caught ' + e.message)
    }
  }

  function* main() {
    try {
      actual.push('start main')
      yield io.fork(genParent)
      actual.push('success main')
    } catch (e) {
      actual.push('main caught ' + e.message)
    }
  }

  const task = goodEnv().run(main)

  const expected = ['start main', 'start parent', 'uncaught immediatelyFailingFork']

  await task.toPromise().catch(err => {
    actual.push('uncaught ' + err.message)
  })
  // saga should propagate errors up to the root of fork tree
  expect(actual).toEqual(expected)
})

test("saga fork's failures: generators", async () => {
  let actual = []

  function* genChild() {
    throw 'gen error'
  }

  function* genParent() {
    try {
      actual.push('start parent')
      yield io.fork(genChild)
      actual.push('success parent')
    } catch (e) {
      actual.push('parent caught ' + e)
    }
  }

  function* main() {
    try {
      actual.push('start main')
      yield io.call(genParent)
      actual.push('success main')
    } catch (e) {
      actual.push('main caught ' + e)
    }
  }

  const task = goodEnv().run(main)

  const expected = ['start main', 'start parent', 'main caught gen error']

  await task.toPromise()
  // saga should fails the parent if a forked generator fails synchronously
  expect(actual).toEqual(expected)
})

test('saga sync fork failures: spawns (detached forks)', async () => {
  let actual = []

  function* genChild() {
    throw new Error('gen error')
  }

  function* main() {
    try {
      actual.push('start main')
      const task = yield io.spawn(genChild)
      // TODO little-saga 中没有实现 task.meta.name
      actual.push('spawn ' + /* task.meta.name */ 'genChild')
      actual.push('success parent')
    } catch (e) {
      actual.push('main caught ' + e.message)
    }
  }

  const task = goodEnv().run(main)

  const expected = ['start main', 'spawn genChild', 'success parent']

  await task.toPromise()
  // saga should not fail a parent with errors from detached forks (using spawn)
  expect(actual).toEqual(expected)
})

// TODO test('saga detached forks failures')
