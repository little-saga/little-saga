import { CANCEL, TASK_CANCEL } from './symbols'
import { flush, suspend } from './scheduler'
import { def, is, noop, remove } from '../utils'
import { createTaskIterator, reportErrorOnly } from './internal-utils'
import Task from './Task'
import ForkQueue from './ForkQueue'

export default function proc(iterator, parentContext, cont) {
  const ctx = Object.create(parentContext)

  const mainTask = {
    // cont: **will be set when passed to ForkQueue**
    isRunning: true,
    isCancelled: false,
    cancel() {
      if (mainTask.isRunning && !mainTask.isCancelled) {
        mainTask.isCancelled = true
        next(TASK_CANCEL)
      }
    },
  }
  const taskQueue = new ForkQueue(mainTask)
  const task = new Task(taskQueue)
  taskQueue.cont = task.end
  task.cont = cont

  cont.cancel = task.cancel
  next()

  return task

  // region function-definitions
  function next(arg, isErr) {
    console.assert(mainTask.isRunning, 'Trying to resume an already finished generator')

    try {
      let result
      if (isErr) {
        result = iterator.throw(arg)
      } else if (arg === TASK_CANCEL) {
        mainTask.isCancelled = true
        next.cancel()
        result = is.func(iterator.return)
          ? iterator.return(TASK_CANCEL)
          : { done: true, value: TASK_CANCEL }
      } else {
        result = iterator.next(arg)
      }

      if (!result.done) {
        digestEffect(result.value, next)
      } else {
        mainTask.isRunning = false
        mainTask.cont(result.value)
      }
    } catch (error) {
      if (mainTask.isCancelled) {
        console.error(error)
      }
      mainTask.isRunning = false
      mainTask.cont(error, true)
    }
  }

  function digestEffect(rawEffect, cb) {
    const normalized = ctx.translator.normalize(rawEffect)
    if (normalized == null) {
      const error = new Error('Unable to normalize effect')
      error.effect = rawEffect
      cb(error, true)
      return
    }

    let effectSettled = false

    function currCb(res, isErr) {
      if (effectSettled) {
        return
      }
      effectSettled = true
      cb.cancel = noop
      cb(res, isErr)
    }
    currCb.cancel = noop

    cb.cancel = () => {
      if (effectSettled) {
        return
      }
      effectSettled = true
      try {
        currCb.cancel()
      } catch (err) {
        console.error(err)
      }
      currCb.cancel = noop
    }

    runEffect(normalized, currCb)
  }

  function runEffect(effect, currCb) {
    const effectType = effect[0]
    if (effectType === 'promise') {
      resolvePromise(effect, ctx, currCb)
    } else if (effectType === 'iterator') {
      resolveIterator(effect, ctx, currCb)
    } else if (effectType === 'fork') {
      runForkEffect(effect, ctx, currCb)
    } else if (effectType === 'spawn') {
      runSpawnEffect(effect, ctx, currCb)
    } else if (effectType === 'join') {
      runJoinEffect(effect, ctx, currCb)
    } else if (effectType === 'cancel') {
      runCancelEffect(effect, ctx, currCb)
    } else if (effectType === 'cancelled') {
      runCancelledEffect(effect, ctx, currCb)
    } else if (effectType === 'def') {
      runDefEffect(effect, ctx, currCb)
    } else {
      const effectRunner = ctx.translator.getRunner(effect)
      if (effectRunner == null) {
        const error = new Error(`Cannot resolve effect-runner for type: ${effectType}`)
        error.effect = effect
        currCb(error, true)
      } else {
        effectRunner(effect, ctx, currCb, { digestEffect })
      }
    }
  }
  // endregion

  // region core-effects-runner
  function resolvePromise([effectType, promise], ctx, cb) {
    const cancelPromise = promise[CANCEL]
    if (is.func(cancelPromise)) {
      cb.cancel = cancelPromise
    }
    promise.then(cb, error => cb(error, true))
  }

  function resolveIterator([effectType, iterator], ctx, cb) {
    proc(iterator, ctx, cb)
  }

  function runForkEffect([effectType, fn, ...args], ctx, cb) {
    const iterator = createTaskIterator(fn, args)
    try {
      suspend()
      const subTask = proc(iterator, ctx, noop)
      if (subTask.isRunning) {
        task.taskQueue.addTask(subTask)
        cb(subTask)
      } else if (subTask.error) {
        task.taskQueue.abort(subTask.error)
      } else {
        cb(subTask)
      }
    } finally {
      flush()
    }
  }

  function runSpawnEffect([effectType, fn, ...args], ctx, cb) {
    const iterator = createTaskIterator(fn, args)
    try {
      suspend()
      cb(proc(iterator, ctx, reportErrorOnly))
    } finally {
      flush()
    }
  }

  function runJoinEffect([effectType, otherTask], ctx, cb) {
    if (otherTask.isRunning) {
      const joiner = { task, cb }
      cb.cancel = () => remove(otherTask.joiners, joiner)
      otherTask.joiners.push(joiner)
    } else {
      if (otherTask.isAborted) {
        cb(otherTask.error, true)
      } else {
        cb(otherTask.result)
      }
    }
  }

  function runCancelEffect([effectType, cancelling = task], ctx, cb) {
    if (cancelling.isRunning) {
      cancelling.cancel()
    }
    cb()
  }

  function runCancelledEffect(effect, ctx, cb) {
    cb(Boolean(mainTask.isCancelled))
  }

  function runDefEffect([_, name, handler], ctx, cb) {
    def(ctx, name, handler)
    cb()
  }
  // endregion
}
