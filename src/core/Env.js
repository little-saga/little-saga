import { def, is } from '../utils'
import proc from './proc'
import { createTaskIterator } from './internal-utils'

const defaultTranslator = {
  getRunner() {
    return null
  },
  normalize(effect) {
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
  },
}

function fallbackCont(result, isErr) {
  if (isErr) {
    throw result
  } else {
    console.log('fallbackCont result:', result)
  }
}

export default class Env {
  constructor(cont = fallbackCont) {
    this.cont = cont
    this.ctx = { translator: defaultTranslator }
  }

  use(enhancer) {
    enhancer(this.ctx)
    return this
  }

  def(type, handler) {
    def(this.ctx, type, handler)
    return this
  }

  run(fn, ...args) {
    const iterator = createTaskIterator(fn, args)
    return proc(iterator, this.ctx, this.cont)
  }
}
