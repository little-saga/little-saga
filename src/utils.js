import { CANCEL } from './core/symbols'

export function deferred(props = {}) {
  const def = { ...props }
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
export const kTrue = () => true

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
}

export function remove(array, item) {
  const index = array.indexOf(item)
  if (index !== -1) {
    array.splice(index, 1)
  }
}

function iteratorAlwaysThrow(error) {
  return {
    next() {
      throw error
    },
    throw(e) {
      throw e
    },
    return() {
      throw error
    },
  }
}

function iteratorAlwaysReturn(value) {
  return {
    next() {
      return { done: true, value }
    },
    throw(e) {
      throw e
    },
    return(v) {
      return { done: true, value: v }
    },
  }
}

export function createTaskIterator(fnObj, args) {
  let result, error
  try {
    const { context, fn } = resolveContextAndFn(fnObj)
    result = fn.apply(context, args)
  } catch (err) {
    error = err
  }

  if (is.iterator(result)) {
    return result
  }
  if (error) {
    return iteratorAlwaysThrow(error)
  } else {
    return iteratorAlwaysReturn(result)
  }
}

export const io = new Proxy(
  {},
  {
    get(_target, property) {
      return (...args) => [property, ...args]
    },
  },
)

export function resolveContextAndFn(arg) {
  if (is.func(arg)) {
    return { context: null, fn: arg }
  } else {
    // [ context, method--or--method-name ]
    const context = arg[0]
    if (is.func(arg[1])) {
      return { context, fn: arg[1] }
    } else {
      return { context, fn: context[arg[1]] }
    }
  }
}
