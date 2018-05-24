import { Env, noop, io } from '../../src'
import commonEffects from '../../src/commonEffects'

test('saga onError is optional', () => {
  const expectedError = new Error('child error')

  function* child() {
    throw expectedError
  }

  function* main() {
    yield io.call(child)
  }

  const task = new Env(noop).use(commonEffects).run(main)

  return task.toPromise().catch(err => {
    expect(err).toBe(expectedError)
  })
})

test('saga onError is called for uncaught error', () => {
  const expectedError = new Error('child error')

  let actualResult
  let actualIsErr

  function* child() {
    throw expectedError
  }

  function* main() {
    yield io.call(child)
  }

  const task = new Env((result, isErr) => {
    actualIsErr = isErr
    actualResult = result
  })
    .use(commonEffects)
    .run(main)

  return task.toPromise().catch(() => {
    expect(actualResult).toBe(expectedError)
    expect(actualIsErr).toBe(true)
  })
})

test('saga onError is not called for caught errors', () => {
  const expectedError = new Error('child error')

  let actualResult
  let actualIsErr
  let caught

  function* child() {
    throw expectedError
  }

  function* main() {
    try {
      yield io.call(child)
    } catch (err) {
      caught = err
    }
  }

  const task = new Env((result, isErr) => {
    actualIsErr = isErr
    actualResult = result
  })
    .use(commonEffects)
    .run(main)

  return task.toPromise().then(() => {
    expect(actualIsErr).toBeFalsy()
    expect(actualResult).toBeUndefined()
    expect(caught).toBe(expectedError)
  })
})
