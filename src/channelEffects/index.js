import { TASK_CANCEL, asap, def } from '..'
import { is, kTrue } from '../utils'
import { multicastChannel, END } from './channel'

function makeMatcher(pattern) {
  if (pattern === '*' || pattern === undefined) {
    return kTrue
  } else if (is.string(pattern)) {
    return action => action && action.type === pattern
  } else if (is.array(pattern)) {
    return action => action && pattern.includes(action.type)
  } else {
    return pattern
  }
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
export function take([effectType, channel, pattern], ctx, cb) {
  if (!is.channel(channel)) {
    pattern = channel
    console.assert(is.channel(ctx.channel))
    channel = ctx.channel
  }
  const takeCb = input => {
    if (input instanceof Error) {
      cb(input, true)
    } else if (input === END) {
      cb(TASK_CANCEL)
    } else {
      cb(input)
    }
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
// yield ['put', SOME_ACTION]
// yield ['put', someChannel, SOME_ACTION]
export function put([effectType, channel, action], ctx, cb) {
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
    // Put effects are non cancellables
  })
}

export const channelEffects = { take, put }

export default function(ctx) {
  ctx.channel = multicastChannel()
  return def(ctx, channelEffects)
}
