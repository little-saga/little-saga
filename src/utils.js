export function deferred(props = {}) {
  const def = { ...props }
  def.promise = new Promise((resolve, reject) => {
    def.resolve = resolve
    def.reject = reject
  })
  return def
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

export function createTaskIterator(fn, args) {
  let result, error
  try {
    result = fn(...args)
  } catch (err) {
    error = err
  }

  if (is.iterator(result)) {
    return result
  }
  if (error) {
    throw error
  } else {
    throw new Error('Cannot create task iterator')
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
