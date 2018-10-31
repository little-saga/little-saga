import { CANCEL, IO } from './symbols'

export function identity(arg) {
  return arg
}

export function deferred(props = {}) {
  const def = Object.assign({}, props)
  def.promise = new Promise((resolve, reject) => {
    def.resolve = resolve
    def.reject = reject
  })
  return def
}

export function delay(ms, val = true) {
  let timeoutId
  const promise = new Promise(resolve => {
    timeoutId = setTimeout(() => resolve(val), ms)
  })

  promise[CANCEL] = () => clearTimeout(timeoutId)

  return promise
}

export const noop = () => {}
export const always = v => () => v

export function once(fn) {
  let called = false
  return () => {
    if (called) {
      return
    }
    called = true
    fn()
  }
}

export const is = {
  func: f => typeof f === 'function',
  number: n => typeof n === 'number',
  string: s => typeof s === 'string',
  symbol: s => typeof s === 'symbol',
  array: Array.isArray,
  object: obj => obj && !is.array(obj) && typeof obj === 'object',
  promise: p => p && is.func(p.then),
  iterator: it => it && is.func(it.next) && is.func(it.throw),
  channel: ch => ch && is.func(ch.take) && is.func(ch.close),
  effect: eff => eff && eff[IO],
}

export function remove(array, item) {
  const index = array.indexOf(item)
  if (index !== -1) {
    array.splice(index, 1)
  }
}

export function makeMatcher(pattern = '*') {
  if (pattern === '*') {
    return always(true)
  } else if (is.string(pattern) || is.symbol(pattern)) {
    return action => action && action.type === pattern
  } else if (is.array(pattern)) {
    const matchers = pattern.map(makeMatcher)
    return action => matchers.some(matcher => matcher(action))
  } else {
    return pattern
  }
}
