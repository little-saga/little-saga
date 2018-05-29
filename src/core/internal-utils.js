import { is } from '../utils'

export function normalizeEffect(effect) {
  if (is.string(effect)) {
    return [effect]
  } else if (is.promise(effect)) {
    return ['promise', effect]
  } else if (is.iterator(effect)) {
    return ['iterator', effect]
  } else if (is.array(effect)) {
    return effect
  } else {
    return null
  }
}

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

function* iteratorAlwaysThrow(error) {
  throw error
}

function* iteratorAlwaysReturn(result) {
  return result
}
