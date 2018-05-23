import { env, noop } from '../../src'

test('fallbackCont can get result when rootSaga completes', () => {
  return env()
    .run(function* rootSaga() {
      return 100
      /* the fallbackCont should print 100 in console */
    })
    .toPromise()
    .then(val => {
      expect(val).toBe(100)
    })
})

test('fallbackCont can get error and then throw the error (1)', () => {
  const error = new Error('some-error-message')
  expect(() => {
    env().run(function*() {
      throw error
    })
  }).toThrow(error.message)
})

test('fallbackCont can get error and then throw the error (2)', () => {
  expect(() => {
    env().run(function*() {
      yield 'unknown-effect-type'
    })
  }).toThrow('Cannot resolve effect-runner')
})

test('fallbackCont dont get error when the error is catched', () => {
  expect(() => {
    env().run(function*() {
      try {
        yield 'unknown-effect-type'
      } catch (e) {
        expect(e.message).toMatch('Cannot resolve effect-runner')
      }
    })
  }).not.toThrow()
})

test('emptyTranslator cannot handle unknown effect types', () => {
  return expect(
    env(noop)
      .run(function*() {
        yield 'unknown-effect-type'
      })
      .toPromise(),
  ).rejects.toThrow('Cannot resolve effect-runner')
})
