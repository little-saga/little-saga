import { createTaskIterator, def } from '../utils'
import proc from './proc'

const emptyTranslator = {
  getRunner() {
    return null
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
    this.ctx = { translator: emptyTranslator }
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
