import { is, resolveContextAndFn } from '..'

export function cps([effectType, fn, ...args], ctx, cb) {
  // CPS (ie node style functions) can define their own cancellation logic
  // by setting cancel field on the cb
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

export function setContext([effectType, partialContext], ctx, cb) {
  Object.assign(ctx, partialContext)
  cb()
}

export function getContext([effectType, prop], ctx, cb) {
  cb(ctx[prop])
}
