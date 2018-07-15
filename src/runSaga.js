import proc from './proc'
import { createTaskIterator, reportErrorOnly } from './internal-utils'
import { stdChannel } from './channel-utils/channels'
import coreEffectRunnerMap from './coreEffectRunnerMap'

export default function runSaga(options, fn, ...args) {
  const {
    taskContext = {},
    cont = reportErrorOnly,
    channel = stdChannel(),
    customEffectRunnerMap = {},
    customEnv = {},
    dispatch,
    getState,
  } = options

  const effectRunnerMap = Object.assign({}, customEffectRunnerMap, coreEffectRunnerMap)

  const env = {
    effectRunnerMap,
    getState,
    channel: channel._connect(dispatch || channel.put),
    ...customEnv,
  }

  const iterator = createTaskIterator(fn, args)
  return proc(env, iterator, taskContext, cont)
}
