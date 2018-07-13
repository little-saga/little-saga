import { always, is, noop } from './utils'
import { TASK_CANCEL } from './index'

export function makeMatcher(pattern) {
  if (pattern === '*' || pattern === undefined) {
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

export function resolveContextAndFn(fnobj) {
  if (is.func(fnobj)) {
    return { context: null, fn: fnobj }
  } else if (is.array(fnobj)) {
    const [context, methodOrName] = fnobj
    return resolveMethod(context, methodOrName)
  } else if (is.object(fnobj)) {
    const { context, fn } = fnobj
    return resolveMethod(context, fn)
  } else {
    throw new Error('Invalid arg passed to resolveContextAndFn')
  }
}

function resolveMethod(context, methodOrName) {
  if (is.func(methodOrName)) {
    return { context, fn: methodOrName }
  } else {
    return { context, fn: context[methodOrName] }
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
    return iteratorAlwaysYieldReturn(result)
  }
}

function* iteratorAlwaysThrow(error) {
  throw error
}

function* iteratorAlwaysYieldReturn(result) {
  return yield result
}

const REPORT_ERROR_ONLY =
  'This following error is reported by reportErrorOnly, this means you have aborted root saga or detached tasks\n'
export const reportErrorOnly = (result, isErr) => isErr && console.error(REPORT_ERROR_ONLY, result)

export function createMutexCallback(parentCallback) {
  let settled = false

  function callback(res, isErr) {
    if (settled) {
      return
    }
    settled = true
    parentCallback.cancel = noop
    parentCallback(res, isErr)
  }
  callback.cancel = noop

  parentCallback.cancel = () => {
    if (settled) {
      return
    }
    settled = true
    try {
      callback.cancel()
    } catch (err) {
      console.error(err)
    }
    callback.cancel = noop
  }

  return callback
}

export function createAllStyleChildCallbacks(shape, parentCallback) {
  const keys = Object.keys(shape)
  const totalCount = keys.length

  let completedCount = 0
  let completed = false
  const results = {}
  const childCallbacks = {}

  function checkEnd() {
    if (completedCount === totalCount) {
      completed = true
      if (is.array(shape)) {
        parentCallback(Array.from(Object.assign(results, { length: totalCount })))
      } else {
        parentCallback(results)
      }
    }
  }

  keys.forEach(key => {
    const chCbAtKey = (res, isErr) => {
      if (completed) {
        return
      }
      if (isErr || res === TASK_CANCEL) {
        parentCallback.cancel()
        parentCallback(res, isErr)
      } else {
        results[key] = res
        completedCount++
        checkEnd()
      }
    }
    chCbAtKey.cancel = noop
    childCallbacks[key] = chCbAtKey
  })

  parentCallback.cancel = () => {
    if (!completed) {
      completed = true
      keys.forEach(key => childCallbacks[key].cancel())
    }
  }

  return {
    childCallbacks,
    keys,
    isCompleted: () => completed,
  }
}

export function createRaceStyleChildCallbacks(shape, parentCallback) {
  let completed = false
  const keys = Object.keys(shape)
  const childCallbacks = {}

  for (const key of keys) {
    const chCbAtKey = (res, isErr) => {
      if (completed) {
        return
      }

      if (isErr) {
        parentCallback.cancel()
        parentCallback(res, true)
      } else if (res !== TASK_CANCEL) {
        parentCallback.cancel()
        completed = true
        const response = { [key]: res }
        if (is.array(shape)) {
          parentCallback(Array.from(Object.assign(response, { length: keys.length })))
        } else {
          parentCallback(response)
        }
      }
    }
    chCbAtKey.cancel = noop
    childCallbacks[key] = chCbAtKey
  }

  parentCallback.cancel = () => {
    if (!completed) {
      completed = true
      keys.forEach(key => childCallbacks[key].cancel())
    }
  }

  return {
    childCallbacks,
    keys,
    isCompleted: () => completed,
  }
}
