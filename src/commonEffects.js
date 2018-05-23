import { def, TASK_CANCEL } from './index'
import { delay, is, noop, resolveContextAndFn } from './utils'

export function all([_, effects], ctx, cb, { digestEffect }) {
  const keys = Object.keys(effects)

  if (keys.length === 0) {
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

export function getContext([effectType, prop], ctx, cb) {
  cb(ctx[prop])
}

export function cps([effectType, fn, ...args], ctx, cb) {
  // CPS (ie node style functions) can define their own cancellation logic
  // by setting cancel field on the cb

  // catch synchronous failures; see redux-saga #152
  try {
    const cpsCb = (err, res) => (err == null ? cb(res) : cb(err, true))
    fn(...args.concat(cpsCb))
    if (cpsCb.cancel) {
      cb.cancel = () => cpsCb.cancel()
    }
  } catch (error) {
    cb(error, true)
  }
}

export function call([effectType, fnObj, ...args], ctx, cb, { digestEffect }) {
  let result
  try {
    const { context, fn } = resolveContextAndFn(fnObj)
    result = fn.apply(context, args)
  } catch (e) {
    cb(e, true)
    return
  }
  if (is.promise(result) || is.iterator(result)) {
    digestEffect(result, cb)
  } else {
    cb(result)
  }
}

export function apply([effectType, context, fn, ...args], ctx, cb, internals) {
  call(['call', [context, fn], ...args], ctx, cb, internals)
}

function delayEffectRunner([_, timeout, returnVal], ctx, cb, { digestEffect }) {
  digestEffect(delay(timeout, returnVal), cb)
}

export default function commonEffects(ctx) {
  def(ctx, 'delay', delayEffectRunner)
  def(ctx, 'call', call)
  def(ctx, 'apply', apply)
  def(ctx, 'all', all)
  def(ctx, 'race', race)
  def(ctx, 'getContext', getContext)
  def(ctx, 'setContext', setContext)
  def(ctx, 'cps', cps)
}
