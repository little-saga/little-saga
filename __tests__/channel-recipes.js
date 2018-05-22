import { env, noop } from '../src'
import commonEffects from '../src/commonEffects'
import channelEffects from '../src/channelEffects'
import { channel, END } from '../src/channelEffects/channel'

test('channel: watcher + max workers', done => {
  const actual = []
  const chan = channel()
  const task = env(noop)
    .use(commonEffects)
    .use(channelEffects)
    .run(function* saga() {
      const { fork, put } = yield 'list'
      for (let i = 0; i < 3; i++) {
        yield fork(worker, i + 1, chan)
      }

      for (let i = 0; i < 10; i++) {
        yield put(chan, i + 1)
      }
      yield put(chan, END)
      yield 'cancel' // TODO need manual cancel...
    })

  function* worker(idx, chan) {
    let count = 0
    while (true) {
      const content = yield ['take', chan]
      actual.push([idx, content])
      // 1st worker will 'sleep' after taking 2 messages on the 1st round
      if (idx === 1 && ++count === 2) {
        yield Promise.resolve()
      }
    }
  }

  task
    .toPromise()
    .then(() => {
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
      done()
    })
    .catch(done)
})
