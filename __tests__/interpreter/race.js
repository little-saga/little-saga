import { deferred, END, io, stdChannel } from '../../src'
import runSaga from '../../src/runSaga'

test('saga race between effects handling', () => {
  let actual = []
  const timeout = deferred()

  const channel = stdChannel()

  const task = runSaga({ channel }, function* genFn() {
    actual.push(
      yield io.race({
        event: io.take('action'),
        timeout: timeout.promise,
      }),
    )
  })

  Promise.resolve(1)
    .then(() => timeout.resolve(1))
    .then(() => channel.put({ type: 'action' }))

  const expected = [{ timeout: 1 }]

  return task.toPromise().then(() => {
    // saga must fulfill race between effects
    expect(actual).toEqual(expected)
  })
})

test('saga race between array of effects handling', () => {
  const actual = []

  const timeout = deferred()

  const channel = stdChannel()
  const task = runSaga({ channel }, function* genFn() {
    actual.push(yield io.race([io.take('action'), timeout.promise]))
  })

  Promise.resolve()
    .then(() => timeout.resolve(1))
    .then(() => channel.put({ type: 'action' }))

  const expected = [[undefined, 1]]

  return task.toPromise().then(() => {
    // saga must fullfill race between array of effects
    expect(actual).toEqual(expected)
  })
})

test('saga race between effects: handle END', async () => {
  const actual = []
  const channel = stdChannel()
  const timeout = deferred()

  const task = runSaga({ channel }, function* genFn() {
    try {
      actual.push(
        yield io.race({
          event: io.take('action'),
          timeout: timeout.promise,
        }),
      )
    } finally {
      actual.push(yield io.cancelled())
    }
  })

  await Promise.resolve()
  channel.put(END)
  timeout.resolve(1)

  await task.toPromise()
  expect(actual).toEqual([true])
})

test('saga race between sync effects', () => {
  const actual = []

  const channel = stdChannel()

  const task = runSaga({ channel }, function* genFn() {
    const xChan = yield io.actionChannel('x')
    const yChan = yield io.actionChannel('y')

    yield io.take('start')

    yield io.race({
      x: io.take(xChan),
      y: io.take(yChan),
    })

    yield Promise.resolve(1) // waiting for next tick

    actual.push(yield io.flush(xChan), yield io.flush(yChan))
  })

  Promise.resolve(1)
    .then(() => channel.put({ type: 'x' }))
    .then(() => channel.put({ type: 'y' }))
    .then(() => channel.put({ type: 'start' }))

  const expected = [[], [{ type: 'y' }]]

  return task.toPromise().then(() => {
    // saga must not run effects when already completed
    expect(actual).toEqual(expected)
  })
})
