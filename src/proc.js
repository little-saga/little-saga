import { CANCEL, TASK_CANCEL } from './symbols'
import { is } from './utils'
import { createMutexCallback } from './internal-utils'
import Task from './Task'

export default function proc(env, iterator, parentContext, cont) {
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
  const task = new Task(mainTask, Object.create(parentContext))
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
        runEffect(result.value, createMutexCallback(next))
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

  function runEffect(effect, cb) {
    if (is.promise(effect)) {
      resolvePromise(effect, cb)
    } else if (is.iterator(effect)) {
      resolveIterator(effect, cb)
    } else if (is.effect(effect)) {
      const runner = env.effectRunnerMap[effect.type]
      if (runner == null) {
        cb(new Error(`${effect.type} effect is not supported`), true)
        return
      }
      runner(effect.payload, cb, { env, task, runEffect })
    } else {
      cb(effect)
    }
  }

  function resolvePromise(promise, cb) {
    const cancelPromise = promise[CANCEL]
    if (is.func(cancelPromise)) {
      cb.cancel = cancelPromise
    }
    promise.then(cb, error => cb(error, true))
  }

  function resolveIterator(iterator, cb) {
    proc(env, iterator, task.taskContext, cb)
  }
  // endregion
}
