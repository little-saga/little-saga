import proc from './proc'
import { createTaskIterator, reportErrorOnly } from './internal-utils'
import { stdChannel } from './channel-utils/channels'
import coreEffectRunnerMap from './coreEffectRunnerMap'

export default function runSaga(options, fn, ...args) {
  const {
    ctx = {},
    cont = reportErrorOnly,
    channel = stdChannel(),
    customEffectRunnerMap = {},
    dispatch,
    getState,
  } = options

  const effectRunnerMap = Object.assign({}, coreEffectRunnerMap, customEffectRunnerMap)

  const env = {
    effectRunnerMap,
    getState,
    channel: channel._connect(dispatch || channel.put),
  }

  const iterator = createTaskIterator(fn, args)
  return proc(env, iterator, ctx, cont)
}
