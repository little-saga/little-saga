import { Env, noop, io } from '../src'
import commonEffects from '../src/commonEffects'
import channelEffects from '../src/channelEffects'
import { channel } from '../src/channelEffects/channel'

test('channel: watcher + max workers', async () => {
  const actual = []
  const chan = channel()
  const task = new Env(noop)
    .use(commonEffects)
    .use(channelEffects)
    .run(function* saga() {
      const { fork, put } = io
      for (let i = 0; i < 3; i++) {
        yield fork(worker, i + 1, chan)
      }

      for (let i = 0; i < 10; i++) {
        yield put(chan, i + 1)
      }
      chan.close()
    })

  function* worker(idx, chan) {
    let count = 0
    while (true) {
      const content = yield io.take(chan)
      actual.push([idx, content])
      // 1st worker will 'sleep' after taking 2 messages on the 1st round
      count++
      if (idx === 1 && count === 2) {
        yield Promise.resolve()
      }
    }
  }

  await task.toPromise()
  expect(actual).toEqual([
    [1, 1],
    [2, 2],
    [3, 3],
    [1, 4],
    [2, 5],
    [3, 6],
    [2, 7],
    [3, 8],
    [2, 9],
    [3, 10],
  ])
})
