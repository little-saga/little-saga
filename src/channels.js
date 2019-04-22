import { always, is, once, remove } from './utils'
import * as buffers from './buffers'

export const END = Symbol('END')
export const MATCH = Symbol('MATCH')

export function channel(buffer = buffers.expanding()) {
  let closed = false
  let takers = []

  function checkForbiddenStates() {
    if (closed && takers.length > 0) {
      throw new Error('Cannot have a closed channel with pending takers')
    }
    if (takers.length > 0 && !buffer.isEmpty()) {
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
    if (takers.length === 0) {
      return buffer.put(input)
    }
    const cb = takers.shift()
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
      if (takers.length > 0) {
        const array = takers
        takers = []
        for (const taker of array) {
          taker(END)
        }
      }
    }
  }

  return {
    take,
    put,
    flush,
    close,
  }
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

    for (const taker of takers) {
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
    for (const taker of takers) {
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

  return { close, put, take }
}
