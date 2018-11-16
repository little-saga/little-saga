import { makeScheduler } from '../src'

test('scheduler executes all recursively triggered tasks in order', () => {
  const scheduler = makeScheduler()
  const actual = []
  scheduler.asap(() => {
    actual.push('1')
    scheduler.asap(() => {
      actual.push('2')
    })
    scheduler.asap(() => {
      actual.push('3')
    })
  })
  expect(actual).toEqual(['1', '2', '3'])
})

test('scheduler when suspended queues up and executes all tasks on flush', () => {
  const scheduler = makeScheduler()
  const actual = []
  scheduler.immediately(() => {
    scheduler.asap(() => {
      actual.push('1')
      scheduler.asap(() => {
        actual.push('2')
      })
      scheduler.asap(() => {
        actual.push('3')
      })
    })
  })
  expect(actual).toEqual(['1', '2', '3'])
})
