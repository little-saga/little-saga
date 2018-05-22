import { def, TASK_CANCEL } from '..'
import { is, noop } from '../utils'

function setIn(object, keyPath, value) {
  const size = keyPath.length
  for (let i = 0; i < size - 1; i++) {
    object = object[keyPath[i]] || {}
  }
  object[keyPath[size - 1]] = value
}

export function delay([_, timeout, returnVal], ctx, cb) {
  const handle = setTimeout(() => cb(returnVal), timeout)
  cb.cancel = () => clearTimeout(handle)
}

export function list(effect, ctx, cb) {
  const result = {}
  for (const typeName of ctx.translator.supportedTypes) {
    setIn(result, typeName.split('.'), (...args) => [typeName, ...args])
  }
  cb(result)
}

export function all([_, effects], ctx, cb, digestEffect) {
  const keys = Object.keys(effects)

  if (!keys.length) {
    cb(is.array(effects) ? [] : {})
    return
  }

  let completedCount = 0
  let completed = false
  const results = {}
  const childCbs = {}

  function checkEffectEnd() {
    if (completedCount === keys.length) {
      completed = true
      cb(is.array(effects) ? Array.from({ ...results, length: keys.length }) : results)
    }
  }

  keys.forEach(key => {
    const chCbAtKey = (res, isErr) => {
      if (completed) {
        return
      }
      if (isErr || res === TASK_CANCEL) {
        cb.cancel()
        cb(res, isErr)
      } else {
        results[key] = res
        completedCount++
        checkEffectEnd()
      }
    }
    chCbAtKey.cancel = noop
    childCbs[key] = chCbAtKey
  })

  cb.cancel = () => {
    if (!completed) {
      completed = true
      keys.forEach(key => childCbs[key].cancel())
    }
  }

  keys.forEach(key => digestEffect(effects[key], childCbs[key]))
}

export function race([_, effects], ctx, cb, digestEffect) {
  let completed = false
  const keys = Object.keys(effects)
  const childCbs = {}

  keys.forEach(key => {
    const chCbAtKey = (res, isErr) => {
      if (completed) {
        return
      }

      if (isErr) {
        // Race Auto cancellation
        cb.cancel()
        cb(res, true)
      } else if (res !== TASK_CANCEL) {
        cb.cancel()
        completed = true
        const response = { [key]: res }
        cb(is.array(effects) ? Array.from({ ...response, length: keys.length }) : response)
      }
    }
    chCbAtKey.cancel = noop
    childCbs[key] = chCbAtKey
  })

  cb.cancel = () => {
    // prevents unnecessary cancellation
    if (!completed) {
      completed = true
      keys.forEach(key => childCbs[key].cancel())
    }
  }
  keys.forEach(key => {
    if (completed) {
      return
    }
    digestEffect(effects[key], childCbs[key])
  })
}

export function setContext([effectType, partialContext], ctx, cb) {
  Object.assign(ctx, partialContext)
  cb()
}

export function getContext(effect, ctx, cb) {
  cb(ctx)
}

export const commonEffects = { delay, list, all, race, getContext, setContext }

export default function enhance(ctx) {
  return def(ctx, commonEffects)
}
