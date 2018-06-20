import { always, is, once, remove } from '../utils'
import * as buffers from './buffers'
import { asap } from '../core/scheduler'

export const END = Symbol('END')
export const MATCH = Symbol('MATCH')
export const SAGA_ACTION = Symbol('SAGA_ACTION')

export function channel(buffer = buffers.expanding()) {
  let closed = false
  let takers = []

  function checkForbiddenStates() {
    if (closed && takers.length) {
      throw new Error('Cannot have a closed channel with pending takers')
    }
    if (takers.length && !buffer.isEmpty()) {
      throw new Error('Cannot have pending takers with non empty buffer')
    }
  }

  function put(input) {
    checkForbiddenStates()
    if (input === undefined) {
      throw new Error('provided with an undefined')
    }

    if (closed) {
      return
    }
    if (!takers.length) {
      return buffer.put(input)
    }
    const cb = takers[0]
    takers.splice(0, 1)
    cb(input)
  }

  function take(cb) {
    checkForbiddenStates()

    if (closed && buffer.isEmpty()) {
      cb(END)
    } else if (!buffer.isEmpty()) {
      cb(buffer.take())
    } else {
      takers.push(cb)
      cb.cancel = () => remove(takers, cb)
    }
  }

  function flush(cb) {
    checkForbiddenStates()

    if (closed && buffer.isEmpty()) {
      cb(END)
      return
    }
    cb(buffer.flush())
  }

  function close() {
    checkForbiddenStates()
    if (!closed) {
      closed = true
      if (takers.length) {
        const arr = takers
        takers = []
        for (let i = 0, len = arr.length; i < len; i++) {
          const taker = arr[i]
          taker(END)
        }
      }
    }
  }

  return liftable({
    take,
    put,
    flush,
    close,
  })
}

export function eventChannel(subscribe, buffer = buffers.none()) {
  let closed = false
  let unsubscribe

  const chan = channel(buffer)
  const close = () => {
    if (is.func(unsubscribe)) {
      unsubscribe()
    }
    chan.close()
  }

  unsubscribe = subscribe(input => {
    if (input === END) {
      close()
      closed = true
      return
    }
    chan.put(input)
  })

  if (!is.func(unsubscribe)) {
    throw new Error('in eventChannel: subscribe should return a function to unsubscribe')
  }

  unsubscribe = once(unsubscribe)

  if (closed) {
    unsubscribe()
  }

  return {
    take: chan.take,
    flush: chan.flush,
    close,
  }
}

function liftable(chan) {
  chan._lift = fn => {
    chan.put = fn(chan.put)
    return chan
  }

  chan._clone = () => liftable({ ...chan })

  chan.connect = fn =>
    chan
      ._lift(scheduleSagaPut)
      ._clone()
      ._lift(() => fn)
      ._lift(wrapSagaDispatch)

  return chan
}

const scheduleSagaPut = put => action => {
  if (action[SAGA_ACTION]) {
    put(action)
  } else {
    asap(() => put(action))
  }
}

const wrapSagaDispatch = put => action => {
  if (is.object(action) || is.array(action)) {
    action[SAGA_ACTION] = true
  }
  put(action)
}

export function multicastChannel() {
  let closed = false
  let currentTakers = []
  let nextTakers = currentTakers

  const ensureCanMutateNextTakers = () => {
    if (nextTakers !== currentTakers) {
      return
    }
    nextTakers = currentTakers.slice()
  }

  const close = () => {
    closed = true
    const takers = (currentTakers = nextTakers)

    for (let i = 0; i < takers.length; i++) {
      const taker = takers[i]
      taker(END)
    }

    nextTakers = []
  }

  const put = input => {
    if (closed) {
      return
    }

    if (input === END) {
      close()
      return
    }

    const takers = (currentTakers = nextTakers)
    for (let i = 0; i < takers.length; i++) {
      const taker = takers[i]
      if (taker[MATCH](input)) {
        taker.cancel()
        taker(input)
      }
    }
  }

  const take = (cb, matcher = always(true)) => {
    if (closed) {
      cb(END)
      return
    }
    cb[MATCH] = matcher
    ensureCanMutateNextTakers()
    nextTakers.push(cb)

    cb.cancel = once(() => {
      ensureCanMutateNextTakers()
      remove(nextTakers, cb)
    })
  }

  return liftable({ close, put, take })
}
