import { is } from '../utils'

function union(arr, items) {
  const result = arr.slice()
  items.forEach(item => {
    if (!result.includes(item)) {
      result.push(item)
    }
  })
  return result
}

export default function def(ctx, nameOrDefObject, handler) {
  let defObject
  if (is.string(nameOrDefObject) && is.func(handler)) {
    defObject = { [nameOrDefObject]: handler }
  } else {
    defObject = nameOrDefObject
  }
  const old = ctx.translator
  const typeNames = Object.keys(defObject)
  if (typeNames.length === 0) {
    return
  }
  const typeNameSet = new Set(typeNames)
  ctx.translator = {
    supportedTypes: union(old.supportedTypes, typeNames),
    getRunner(effect) {
      const type = effect[0]
      if (typeNameSet.has(type)) {
        return defObject[type]
      } else {
        return old.getRunner(effect)
      }
    },
  }
  return ctx
}
