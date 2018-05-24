import { is, noop, TASK_CANCEL } from '..'

export default function all([_, effects], ctx, cb, { digestEffect }) {
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
      cb(is.array(effects) ? Array.from(Object.assign(results, { length: keys.length })) : results)
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
