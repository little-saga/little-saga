import { Env, noop } from '../../src'
import commonEffects from '../../src/commonEffects'

test('fallbackCont can get result when rootSaga completes', () => {
  return new Env()
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
  let output
  console.error = jest.fn(arg => (output = arg))
  new Env().run(function*() {
    throw error
  })
  expect(output.message).toMatch(error.message)
})

test('fallbackCont can get error and then throw the error (2)', () => {
  let output
  console.error = jest.fn(arg => (output = arg))
  new Env().run(function*() {
    yield 'unknown-effect-type'
  })
  expect(output.message).toMatch('Cannot resolve effect-runner')
})

test('fallbackCont dont get error when the error is catched', () => {
  expect(() => {
    new Env().run(function*() {
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
    new Env(noop)
      .use(commonEffects)
      .run(function*() {
        yield 'unknown-effect-type'
      })
      .toPromise(),
  ).rejects.toThrow('Cannot resolve effect-runner')
})
