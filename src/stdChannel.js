import { is } from './utils'
import { multicastChannel } from './channels'
import defaultScheduler from './defaultScheduler'

export const SCHEDULED = Symbol('SCHEDULED')

export const markAsScheduled = put => action => {
  if (is.object(action) || is.array(action)) {
    action[SCHEDULED] = true
  }
  put(action)
}

function enhanceable(chan) {
  chan.enhancePut = fn => {
    chan.put = fn(chan.put)
    return chan
  }

  chan.clone = () => enhanceable({ ...chan })

  return chan
}

export function stdChannel(scheduler = defaultScheduler) {
  const ensureScheduled = put => action => {
    if (action[SCHEDULED]) {
      put(action)
    } else {
      scheduler.asap(() => put(action))
    }
  }

  return enhanceable(multicastChannel()).enhancePut(ensureScheduled)
}
