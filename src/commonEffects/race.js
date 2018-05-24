import { is, noop, TASK_CANCEL } from '../index'

export default function race([_, effects], ctx, cb, { digestEffect }) {
  let completed = false
  const keys = Object.keys(effects)
  const childCbs = {}

  keys.forEach(key => {
    const chCbAtKey = (res, isErr) => {
      if (completed) {
        return
      }

      if (isErr) {
        cb.cancel()
        cb(res, true)
      } else if (res !== TASK_CANCEL) {
        cb.cancel()
        completed = true
        const response = { [key]: res }
        cb(
          is.array(effects)
            ? Array.from(Object.assign(response, { length: keys.length }))
            : response,
        )
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
