import { is } from '../utils'

export function resolveContextAndFn(arg) {
  if (is.func(arg)) {
    return { context: null, fn: arg }
  } else {
    const [context, methodOrName] = arg
    if (is.func(methodOrName)) {
      return { context, fn: methodOrName }
    } else {
      return { context, fn: context[methodOrName] }
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

export const reportErrorOnly = (result, isErr) => isErr && console.error(result)
