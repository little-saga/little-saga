import { asap, TASK_CANCEL } from '..'
import { is, always } from '../utils'
import { channel, END, multicastChannel } from './channel'
import * as buffers from './buffers'

export * from './channel'
export { buffers }
export { default as connectToEmitter } from './connectToEmitter'

function makeMatcher(pattern) {
  if (pattern === '*' || pattern === undefined) {
    return always(true)
  } else if (is.string(pattern) || is.symbol(pattern)) {
    return action => action && action.type === pattern
  } else if (is.array(pattern)) {
    const matchers = pattern.map(makeMatcher)
    return action => matchers.some(matcher => matcher(action))
  } else {
    return pattern
  }
}

function doTake(channel, pattern, maybe, ctx, cb) {
  if (!is.channel(channel)) {
    pattern = channel
    console.assert(is.channel(ctx.channel))
    channel = ctx.channel
  }
  const takeCb = input => {
    if (input instanceof Error) {
      cb(input, true)
      return
    }
    if (input === END && !maybe) {
      cb(TASK_CANCEL)
      return
    }
    cb(input)
  }
  try {
    channel.take(takeCb, makeMatcher(pattern))
  } catch (err) {
    cb(err, true)
    return
  }
  cb.cancel = takeCb.cancel
}

// common usages:
// yield ['take']
// yield ['take', 'SOME_TYPE']
// yield ['take', [TYPE1, TYPE2, TYPE3] ]
// yield ['take', action => action.type === 'SOME_TYPE']
// yield ['take', someChannel]
// yield ['take', someChannel, 'SOME_TYPE']
// yield ['take', someChannel, [TYPE1, TYPE2, TYPE3]]
// yield ['take', someChannel, action => action.type === 'SOME_TYPE']
function take([effectType, channel, pattern], ctx, cb) {
  doTake(channel, pattern, false, ctx, cb)
}

function takeMaybe([effectType, channel, pattern], ctx, cb) {
  doTake(channel, pattern, true, ctx, cb)
}

// common usages:
// yield ['put', SOME_ACTION]
// yield ['put', someChannel, SOME_ACTION]
function put([effectType, channel, action], ctx, cb) {
  if (!is.channel(channel)) {
    action = channel
    console.assert(is.channel(ctx.channel))
    channel = ctx.channel
  }
  asap(() => {
    let result
    try {
      result = channel.put(action)
    } catch (err) {
      cb(err, true)
      return
    }
    cb(result)
    // Put effects cannot be cancelled
  })
}

function flush([effectType, channel], ctx, cb) {
  channel.flush(cb)
}

function actionChannel([effectType, pattern, buffer], ctx, cb) {
  const chan = channel(buffer)
  const match = makeMatcher(pattern)

  const taker = action => {
    if (action !== END) {
      ctx.channel.take(taker, match)
    }
    chan.put(action)
  }

  ctx.channel.take(taker, match)
  cb(chan)
}

const map = new Map([
  ['take', take],
  ['takeMaybe', takeMaybe],
  ['put', put],
  ['actionChannel', actionChannel],
  ['flush', flush],
])

export default function(ctx) {
  ctx.channel = multicastChannel()

  const last = ctx.translator
  ctx.translator = {
    ...last,
    getRunner(effect) {
      const effectType = effect[0]
      if (map.has(effectType)) {
        return map.get(effectType)
      } else {
        return last.getRunner(effect)
      }
    },
  }
}
