import { is } from '../utils'

export function normalizeEffect(effect, currCb) {
  if (is.string(effect)) {
    return [effect]
  } else if (is.promise(effect)) {
    return ['promise', effect]
  } else if (is.iterator(effect)) {
    return ['iterator', effect]
  } else if (is.array(effect)) {
    return effect
  } else {
    const error = new Error('Unable to normalize effect')
    error.effect = effect
    currCb(error, true)
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
    return dumbIterators.throw(error)
  } else {
    return dumbIterators.return(result)
  }
}

const dumbIterators = {
  *throw(error) {
    throw error
  },
  // https://github.com/mishoo/UglifyJS2/issues/3092
  return(value) {
    return {
      next() {
        return { done: true, value }
      },
      throw(e) {
        throw e
      },
      return(v) {
        return v
      },
    }
  },
}
