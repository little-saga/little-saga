import proc from './proc'
import { createTaskIterator, reportErrorOnly } from './internal-utils'
import { stdChannel } from './channel-utils/channels'
import coreEffectRunnerMap from './coreEffectRunnerMap'

export default function runSaga(options, fn, ...args) {
  const {
    taskContext = {},
    cont = reportErrorOnly,
    channel: channel_0,
    customEffectRunnerMap = {},
    customEnv = {},
    dispatch,
    getState,
  } = options

  const effectRunnerMap = Object.assign({}, customEffectRunnerMap, coreEffectRunnerMap)

  // TODO 之所以没有在解构 options 中使用默认参数，是因为 rollup（也可能是 babel）有 bug
  const channel = channel_0 || stdChannel()

  const env = {
    effectRunnerMap,
    getState,
    channel: channel._connect(dispatch || channel.put),
    ...customEnv,
  }

  const iterator = createTaskIterator(fn, args)
  return proc(env, iterator, taskContext, cont)
}
