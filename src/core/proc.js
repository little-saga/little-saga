import { createTaskIterator, deferred, is, noop, remove } from '../utils'
import { CANCEL, def, flush, suspend, TASK, TASK_CANCEL } from '..'

function forkQueue(mainTask, cb) {
  let tasks = []
  let result
  let completed = false

  addTask(mainTask)

  function abort(err) {
    cancelAll()
    cb(err, true)
  }

  function addTask(task) {
    tasks.push(task)
    task.cont = (res, isErr) => {
      if (completed) {
        return
      }

      remove(tasks, task)
      task.cont = noop
      if (isErr) {
        abort(res)
      } else {
        if (task === mainTask) {
          result = res
        }
        if (tasks.length === 0) {
          completed = true
          cb(result)
        }
      }
    }
  }

  function cancelAll() {
    if (completed) {
      return
    }
    completed = true
    tasks.forEach(t => {
      t.cont = noop
      t.cancel()
    })
    tasks = []
  }

  return {
    addTask,
    cancelAll,
    abort,
  }
}

export default function proc(iterator, parentContext, cont) {
  const ctx = Object.create(parentContext)
  const task = newTask(iterator, cont)
  const mainTask = {
    cancel: cancelMain,
    isRunning: true,
    isCancelled: false,
    // cont: **will be set when passed to forkQueue**
  }
  const taskQueue = forkQueue(mainTask, end)

  iterator._isRunning = true
  iterator._isCancelled = false
  iterator._isAborted = false
  iterator._result = undefined
  iterator._error = undefined

  cont.cancel = cancel
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
        result = iterator.return(TASK_CANCEL)
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

    runEffect(normalizeEffect(rawEffect), currCb)
  }

  function normalizeEffect(effect) {
    if (is.string(effect)) {
      return [effect]
    } else if (is.promise(effect)) {
      return ['promise', effect]
    } else if (is.iterator(effect)) {
      return ['iterator', effect]
    } else if (is.array(effect)) {
      return effect
    } else {
      throw new Error('Unable to normalize effect')
    }
  }

  function runEffect(effect, currCb) {
    const effectType = effect[0]
    if (effectType === 'promise') {
      resolvePromise(effect, ctx, currCb)
    } else if (effectType === 'iterator') {
      resolveIterator(iterator, ctx, currCb)
    } else if (effectType === 'fork') {
      runForkEffect(effect, ctx, currCb)
    } else if (effectType === 'join') {
      runJoinEffect(effect, ctx, currCb)
    } else if (effectType === 'cancel') {
      runCancelEffect(effect, ctx, currCb)
    } else if (effectType === 'def') {
      runDefEffect(effect, ctx, currCb)
    } else {
      const effectRunner = ctx.translator.getRunner(effect)
      if (effectRunner == null) {
        const error = new Error(`Cannot resolve effect-runner for type: ${effectType}`)
        error.effect = effect
        currCb(error, true)
      } else {
        effectRunner(effect, ctx, currCb, digestEffect)
      }
    }
  }

  function cancel() {
    if (iterator._isRunning && !iterator._isCancelled) {
      iterator._isCancelled = true
      taskQueue.cancelAll()
      end(TASK_CANCEL)
    }
  }

  function end(result, isErr) {
    iterator._isRunning = false
    if (!isErr) {
      iterator._result = result
      iterator._deferredEnd && iterator._deferredEnd.resolve(result)
    } else {
      iterator._error = result
      iterator._isAborted = true
      iterator._deferredEnd && iterator._deferredEnd.reject(result)
    }

    task.cont(result, isErr)
    task.joiners.forEach(j => j.cb(result, isErr))
    task.joiners = null
  }

  function cancelMain() {
    if (mainTask.isRunning && !mainTask.isCancelled) {
      mainTask.isCancelled = true
      next(TASK_CANCEL)
    }
  }

  function newTask(iterator, cont) {
    iterator._deferredEnd = null
    return {
      [TASK]: true,
      toPromise() {
        if (iterator._deferredEnd) {
          return iterator._deferredEnd.promise
        }

        const def = deferred()
        iterator._deferredEnd = def

        if (!iterator._isRunning) {
          if (iterator._isAborted) {
            def.reject(iterator._error)
          } else {
            def.resolve(iterator._result)
          }
        }
        return def.promise
      },
      cont,
      joiners: [],
      cancel,
      isRunning: () => iterator._isRunning,
      isCancelled: () => iterator._isCancelled,
      isAborted: () => iterator._isAborted,
      result: () => iterator._result,
      error: () => iterator._error,
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
      const task = proc(iterator, ctx, cb)
      if (iterator._isRunning) {
        taskQueue.addTask(task)
        cb(task)
      } else if (iterator._error) {
        taskQueue.abort(iterator._error)
      } else {
        cb(task)
      }
    } finally {
      flush()
    }
  }

  function runJoinEffect([effectType, otherTask], ctx, cb) {
    if (otherTask.isRunning()) {
      const joiner = { task, cb }
      cb.cancel = () => remove(otherTask.joiners, joiner)
      otherTask.joiners.push(joiner)
    } else {
      if (otherTask.isAborted()) {
        cb(otherTask.error(), true)
      } else {
        cb(otherTask.result())
      }
    }
  }

  function runCancelEffect([effectType, taskToCancel], ctx, cb) {
    if (taskToCancel == null) {
      taskToCancel = task
    }
    if (taskToCancel.isRunning()) {
      taskToCancel.cancel()
    }
    cb()
  }

  function runDefEffect([_, nameOrDefObject, handler], ctx, cb) {
    def(ctx, nameOrDefObject, handler)
    cb()
  }
  // endregion
}
