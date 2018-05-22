import { def, TASK_CANCEL } from './index'
import { is, noop, actionCreators } from './utils'

export function delay([_, timeout, returnVal], ctx, cb) {
  const handle = setTimeout(() => cb(returnVal), timeout)
  cb.cancel = () => clearTimeout(handle)
}

export function list(_effect, _ctx, cb) {
  cb(actionCreators)
}

export function all([_, effects], ctx, cb, { digestEffect }) {
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

export function race([_, effects], ctx, cb, { digestEffect }) {
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

export default function commonEffects(ctx) {
  def(ctx, 'delay', delay)
  def(ctx, 'list', list)
  def(ctx, 'all', all)
  def(ctx, 'race', race)
  def(ctx, 'getContext', getContext)
  def(ctx, 'setContext', setContext)
}
