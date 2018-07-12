import { deferred, remove, is, delay, Env, io, noop, identity, once } from '../../src'
import commonEffects from '../../src/commonEffects'
import channelEffects from '../../src/channel-utils'

const { join, fork, cancel, spawn, take, put } = io

test('object effect cannot be normalized', () => {
  let output
  console.error = jest.fn(arg => (output = arg))
  new Env().run(function*() {
    yield { foo: 'bar' }
  })
  expect(output.message).toMatch('Unable to normalize effect')
})

test('use def effect to define customized effect-types', async () => {
  const actual = []
  const task = new Env(noop).run(function*() {
    const { def, fork } = io
    yield def('Parent', (_, ctx, cb) => cb('response-Parent'))

    actual.push('yield Parent in parent: ' + (yield 'Parent'))
    try {
      actual.push('yield Child in parent-1: ' + (yield 'Child'))
    } catch (e) {
      actual.push('yield Child in parent-1: fail')
    }

    yield fork(function* child() {
      yield def('Child', (_, ctx, cb) => cb('response-Child'))

      actual.push('yield Parent in Child: ' + (yield 'Parent'))
      actual.push('yield Child in Child: ' + (yield 'Child'))
    })

    try {
      actual.push('yield Child in parent-2: ' + (yield 'Child'))
    } catch (e) {
      actual.push('yield Child in parent-2: fail')
    }
  })

  await task.toPromise()
  expect(actual).toEqual([
    'yield Parent in parent: response-Parent',
    'yield Child in parent-1: fail',
    'yield Parent in Child: response-Parent',
    'yield Child in Child: response-Child',
    'yield Child in parent-2: fail',
  ])
})

test('use def effect to define customized effect-types', async () => {
  const def = deferred()
  const task = new Env(noop).run(function*() {
    yield def.promise
  })

  const promise = task.toPromise()
  def.reject('manual-rejection')
  await promise.catch(e => {
    expect(e).toEqual('manual-rejection')
  })
})

test('cancel delay', async () => {
  let actual1
  let actual2
  const rootTask = new Env(noop).use(commonEffects).run(function*() {
    const task1 = yield fork(function*() {
      actual1 = yield delay(0, 'non-cancel-value')
    })
    yield cancel(task1)

    const task2 = yield fork(function*() {
      actual2 = yield delay(0, 'non-cancel-value')
    })
    // we do not cancel task2
  })

  await rootTask.toPromise()
  expect(actual1).toBeUndefined()
  expect(actual2).toBe('non-cancel-value')
})

test('join an aborted task', async () => {
  const error = new Error('manual-abort')
  let actual = []

  const task = new Env(noop)
    .use(commonEffects)
    .use(channelEffects)
    .run(function*() {
      const task = yield spawn(function*() {
        yield take('START')
        throw error
      })

      actual.push('before-isRunning:' + task.isRunning)
      actual.push('before-error:', task.error)

      yield put({ type: 'START' })

      actual.push('after-isRunning:' + task.isRunning)
      actual.push('after-error:', task.error)

      try {
        yield join(task)
      } catch (e) {
        actual.push('joining-task:', e)
      }
    })

  await task
    .toPromise()
    .catch(e => {
      actual.push(e.message)
    })
    .then(() => {
      expect(actual).toEqual([
        'before-isRunning:true',
        'before-error:',
        undefined,
        'after-isRunning:false',
        'after-error:',
        error,
        'joining-task:',
        error,
      ])
    })
})

test('util functions', () => {
  expect(identity(1234)).toBe(1234)
  expect(identity('str')).toBe('str')
  expect(identity({})).not.toBe({})

  let actual = []
  const fn = once(() => {
    actual.push('once')
  })

  fn()
  fn()
  fn()
  expect(actual).toEqual(['once'])

  expect(is.number(1234)).toBe(true)
  expect(is.number('1234')).toBe(false)

  const array1 = [0, 1, 2, 3, 4]
  remove(array1, 2)
  expect(array1).toEqual([0, 1, 3, 4])

  const array2 = [0, 1, 2, 3, 4]
  remove(array2, 'not-exist')
  expect(array2).toEqual([0, 1, 2, 3, 4])
})

test('get full context', async () => {
  function justThrow(result, isErr) {
    if (isErr) {
      throw result
    }
  }

  new Env(justThrow).use(commonEffects).run(function*() {
    expect(yield 'getContext').toEqual({ translator: undefined })

    channelEffects(yield 'getContext')
    const keys = Object.keys(yield 'getContext')
    expect(keys.length).toBe(2)
    expect(keys).toContain('translator')
    expect(keys).toContain('channel')
  })
})
