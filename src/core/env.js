import { is, createTaskIterator } from '../utils'
import def from './def'
import proc from './proc'

const stdTranslator = {
  supportedTypes: ['promise', 'iterator', 'fork', 'join', 'cancel', 'def'],
  getRunner() {},
}

function fallbackCont(result, isErr) {
  if (isErr) {
    console.error('fallbackCont error:', result)
  } else {
    console.log('fallbackCont result:', result)
  }
}

export default function env(cont = fallbackCont) {
  let ctx = { translator: stdTranslator }

  return {
    use(arg1, arg2) {
      if (is.func(arg1)) {
        ctx = arg1(ctx) || ctx
      } else {
        def(ctx, arg1, arg2)
      }
      return this
    },
    run(fn, ...args) {
      const iterator = createTaskIterator(fn, args)
      return proc(iterator, ctx, cont)
    },
  }
}
