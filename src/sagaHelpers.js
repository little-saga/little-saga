import { io, delay, buffers } from './index'

export function takeEvery(patternOrChannel, worker, ...args) {
  return io.fork(function*() {
    while (true) {
      const action = yield io.take(patternOrChannel)
      yield io.fork(worker, ...args, action)
    }
  })
}

export function takeLeading(patternOrChannel, worker, ...args) {
  return io.fork(function*() {
    while (true) {
      const action = yield io.take(patternOrChannel)
      yield io.call(worker, ...args, action)
    }
  })
}

export function takeLatest(patternOrChannel, worker, ...args) {
  return io.fork(function*() {
    let task = null
    while (true) {
      const action = yield io.take(patternOrChannel)
      if (task) {
        yield io.cancel(task)
      }
      task = yield io.fork(worker, ...args, action)
    }
  })
}

export function throttle(ms, pattern, worker, ...args) {
  return io.fork(function*() {
    const throttleChannel = yield io.actionChannel(pattern, buffers.sliding(1))
    while (true) {
      const action = yield io.take(throttleChannel)
      yield io.fork(worker, ...args, action)
      yield delay(ms)
    }
  })
}

export function debounce(ms, channelOrPattern, worker, ...args) {
  return io.fork(function*() {
    while (true) {
      let action = yield io.take(channelOrPattern)
      while (true) {
        const [nextAction, timeout] = yield io.race([io.take(channelOrPattern), delay(ms)])
        if (timeout) {
          yield io.fork(worker, ...args, action)
          break
        } else {
          action = nextAction
        }
      }
    }
  })
}
