import { createTaskIterator } from '../utils'
import def from './def'
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

export default function env(cont = fallbackCont) {
  const ctx = { translator: emptyTranslator }

  return {
    use(enhancer) {
      enhancer(ctx)
      return this
    },
    def(type, handler) {
      def(ctx, type, handler)
      return this
    },
    run(fn, ...args) {
      const iterator = createTaskIterator(fn, args)
      return proc(iterator, ctx, cont)
    },
  }
}
