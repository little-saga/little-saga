import proc from './proc'
import { createTaskIterator, reportErrorOnly } from './internal-utils'
import { stdChannel, markAsScheduled } from './stdChannel'
import defaultScheduler from './defaultScheduler'

export default function runSaga(options, fn, ...args) {
  const {
    scheduler = defaultScheduler,
    taskContext = {},
    channel = stdChannel(scheduler),
    customEnv = {},
    getState,
    setState,
    cont = reportErrorOnly,
  } = options

  const env = {
    scheduler,
    getState,
    setState,
    channel: channel.clone().enhancePut(markAsScheduled),
    ...customEnv,
  }

  const iterator = createTaskIterator(fn, args)

  return scheduler.immediately(() => proc(env, iterator, taskContext, cont))
}
