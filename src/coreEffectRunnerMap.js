import { is, noop, remove } from './utils'
import { asap, immediately } from './scheduler'
import proc from './proc'
import { channel, END } from './channel-utils/channels'
import { SELF_CANCELLATION, TASK_CANCEL } from './symbols'
import {
  createAllStyleChildCallbacks,
  createRaceStyleChildCallbacks,
  createTaskIterator,
  makeMatcher,
  reportErrorOnly,
} from './internal-utils'

function runForkEffect({ fn, args, detached }, cb, { env, task }) {
  immediately(() => {
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

function runJoinEffect(taskOrTasks, cb, { task }) {
  if (is.array(taskOrTasks)) {
    if (taskOrTasks.length === 0) {
      cb([])
      return
    }
    const { childCallbacks } = createAllStyleChildCallbacks(taskOrTasks, cb)
    taskOrTasks.forEach((t, i) => {
      joinSingleTask(t, childCallbacks[i], task)
    })
  } else {
    joinSingleTask(taskOrTasks, cb, task)
  }
}

function joinSingleTask(taskToJoin, cb, task) {
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

function runCancelEffect(taskOrTasks, cb, { task }) {
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

function runCancelledEffect(effect, cb, { task }) {
  cb(task.taskQueue.mainTask.isCancelled)
}

function runAllEffect(effects, cb, { runEffect }) {
  const { childCallbacks, keys } = createAllStyleChildCallbacks(effects, cb)

  if (keys.length === 0) {
    cb(is.array(effects) ? [] : {})
    return
  }

  keys.forEach(key => runEffect(effects[key], childCallbacks[key]))
}

function runRaceEffect(effects, cb, { runEffect }) {
  const { keys, childCallbacks, isCompleted } = createRaceStyleChildCallbacks(effects, cb)
  for (const key of keys) {
    if (isCompleted()) {
      return
    }
    runEffect(effects[key], childCallbacks[key])
  }
}

function runCPSEffect({ fn, args }, cb) {
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

function runCallEffect({ context, fn, args }, cb, { runEffect }) {
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

export function runSetContextEffect({ prop, value }, cb, { task }) {
  task.taskContext[prop] = value
  cb()
}

export function runGetContextEffect(prop, cb, { task }) {
  cb(task.taskContext[prop])
}

export function runSelectEffect({ selector, args }, cb, { env }) {
  cb(selector(env.getState(), ...args))
}

function runTakeEffect({ channel, pattern, maybe }, cb, { env }) {
  channel = channel || env.channel
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

function runPutEffect(payload, cb, { env, runEffect }) {
  const { channel = env.channel, action, resolve } = payload
  asap(() => {
    let result
    try {
      result = channel.put(action)
    } catch (err) {
      cb(err, true)
      return
    }

    if (resolve && is.promise(result)) {
      runEffect(result, cb)
    } else {
      cb(result)
    }
    // Put effects cannot be cancelled
  })
}

function runFlushEffect(channel, cb) {
  channel.flush(cb)
}

function runActionChannelEffect({ pattern, buffer }, cb, { env }) {
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
  SELECT: runSelectEffect,
  TAKE: runTakeEffect,
  PUT: runPutEffect,
  FLUSH: runFlushEffect,
  ACTION_CHANNEL: runActionChannelEffect,
}
