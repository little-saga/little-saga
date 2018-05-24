import { io, delay } from '..'
import { buffers } from '../channelEffects'

const { fork, take, call, actionChannel, cancel } = io

export function takeEvery(patternOrChannel, worker, ...args) {
  return fork(function*() {
    while (true) {
      const action = yield take(patternOrChannel)
      yield fork(worker, ...args, action)
    }
  })
}

export function takeLeading(patternOrChannel, worker, ...args) {
  return fork(function*() {
    while (true) {
      const action = yield take(patternOrChannel)
      yield call(worker, ...args, action)
    }
  })
}

export function takeLatest(patternOrChannel, worker, ...args) {
  return fork(function*() {
    let task = null
    while (true) {
      const action = yield take(patternOrChannel)
      if (task) {
        yield cancel(task)
      }
      task = yield fork(worker, ...args, action)
    }
  })
}

export function throttle(ms, pattern, worker, ...args) {
  return fork(function*() {
    const throttleChannel = yield actionChannel(pattern, buffers.sliding(1))
    while (true) {
      const action = yield take(throttleChannel)
      yield fork(worker, ...args, action)
      yield delay(ms)
    }
  })
}
