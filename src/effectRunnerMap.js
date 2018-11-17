import { is, makeMatcher, noop, remove } from './utils'
import proc from './proc'
import { channel, END } from './channels'
import { SELF_CANCELLATION, TASK_CANCEL } from './symbols'
import {
  createAllStyleChildCallbacks,
  createRaceStyleChildCallbacks,
  createTaskIterator,
  reportErrorOnly,
} from './internal-utils'

function runForkEffect(env, task, { fn, args, detached }, cb) {
  env.scheduler.immediately(() => {
    const iterator = createTaskIterator(fn, args)
    if (detached) {
      cb(proc(env, iterator, task.taskContext, reportErrorOnly))
    } else {
      const subTask = proc(env, iterator, task.taskContext, noop)
      if (subTask.isRunning) {
        task.taskQueue.addTask(subTask)
        cb(subTask)
      } else if (subTask.error) {
        task.taskQueue.abort(subTask.error)
      } else {
        cb(subTask)
      }
    }
  })
}

function runJoinEffect(env, task, tasksToJoin, cb) {
  if (is.array(tasksToJoin)) {
    if (tasksToJoin.length === 0) {
      cb([])
      return
    }
    const { childCallbacks } = createAllStyleChildCallbacks(tasksToJoin, cb)
    tasksToJoin.forEach((t, i) => {
      joinSingleTask(task, t, childCallbacks[i])
    })
  } else {
    joinSingleTask(task, tasksToJoin, cb)
  }
}

function joinSingleTask(task, taskToJoin, cb) {
  if (taskToJoin.isRunning) {
    const joiner = { task, cb }
    cb.cancel = () => remove(taskToJoin.joiners, joiner)
    taskToJoin.joiners.push(joiner)
  } else {
    if (taskToJoin.isAborted) {
      cb(taskToJoin.error, true)
    } else {
      cb(taskToJoin.result)
    }
  }
}

function runCancelEffect(env, task, taskOrTasks, cb) {
  if (taskOrTasks === SELF_CANCELLATION) {
    cancelSingleTask(task)
  } else if (is.array(taskOrTasks)) {
    for (const t of taskOrTasks) {
      cancelSingleTask(t)
    }
  } else {
    cancelSingleTask(taskOrTasks)
  }
  cb()
}

function cancelSingleTask(taskToCancel) {
  if (taskToCancel.isRunning) {
    taskToCancel.cancel()
  }
}

function runCancelledEffect(env, task, payload, cb) {
  cb(task.taskQueue.mainTask.isCancelled)
}

function runAllEffect(env, task, effects, cb, { runEffect }) {
  const { childCallbacks, keys } = createAllStyleChildCallbacks(effects, cb)

  if (keys.length === 0) {
    cb(is.array(effects) ? [] : {})
    return
  }

  keys.forEach(key => runEffect(effects[key], childCallbacks[key]))
}

function runRaceEffect(env, task, effects, cb, { runEffect }) {
  const { keys, childCallbacks, isCompleted } = createRaceStyleChildCallbacks(effects, cb)
  for (const key of keys) {
    if (isCompleted()) {
      return
    }
    runEffect(effects[key], childCallbacks[key])
  }
}

function runCPSEffect(env, task, { fn, args }, cb) {
  try {
    const cpsCb = (err, res) => (err == null ? cb(res) : cb(err, true))
    fn(...args, cpsCb)
    if (cpsCb.cancel) {
      cb.cancel = () => cpsCb.cancel()
    }
  } catch (error) {
    cb(error, true)
  }
}

function runCallEffect(env, task, { context, fn, args }, cb, { runEffect }) {
  let result
  try {
    result = fn.apply(context, args)
  } catch (e) {
    cb(e, true)
    return
  }
  if (is.promise(result) || is.iterator(result)) {
    runEffect(result, cb)
  } else {
    cb(result)
  }
}

export function runSetContextEffect(env, task, { prop, value }, cb) {
  task.taskContext[prop] = value
  cb()
}

export function runGetContextEffect(env, task, prop, cb) {
  cb(task.taskContext[prop])
}

export function runGetEnvEffect(env, task, payload, cb) {
  cb(env)
}

export function runSelectEffect(env, task, { selector, args }, cb) {
  cb(selector(env.getState(), ...args))
}

function runTakeEffect(env, task, { channel = env.channel, pattern, maybe }, cb) {
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

function runPutEffect(env, task, { channel = env.channel, action }, cb) {
  env.scheduler.asap(() => {
    try {
      cb(channel.put(action))
    } catch (err) {
      cb(err, true)
    }
  })
}

function runFlushEffect(env, task, channel, cb) {
  channel.flush(cb)
}

function runActionChannelEffect(env, task, { pattern, buffer }, cb) {
  const chan = channel(buffer)
  const match = makeMatcher(pattern)

  const taker = action => {
    if (action !== END) {
      env.channel.take(taker, match)
    }
    chan.put(action)
  }

  const { close } = chan
  chan.close = () => {
    taker.cancel()
    close()
  }

  env.channel.take(taker, match)
  cb(chan)
}

export default {
  FORK: runForkEffect,
  JOIN: runJoinEffect,
  CANCEL: runCancelEffect,
  CANCELLED: runCancelledEffect,
  ALL: runAllEffect,
  RACE: runRaceEffect,
  CPS: runCPSEffect,
  CALL: runCallEffect,
  SET_CONTEXT: runSetContextEffect,
  GET_CONTEXT: runGetContextEffect,
  GET_ENV: runGetEnvEffect,
  SELECT: runSelectEffect,
  TAKE: runTakeEffect,
  PUT: runPutEffect,
  FLUSH: runFlushEffect,
  ACTION_CHANNEL: runActionChannelEffect,
}
