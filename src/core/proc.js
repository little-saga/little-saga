import { CANCEL, TASK_CANCEL } from './symbols'
import { flush, suspend } from './scheduler'
import { createTaskIterator, def, deferred, is, noop, remove } from '../utils'

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
      if (!mainTask.isRunning) {
        throw error
      }
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

    const normalized = normalizeEffect(rawEffect, currCb)
    runEffect(normalized, currCb)
  }

  function normalizeEffect(effect, currCb) {
    if (is.string(effect)) {
      return [effect]
    } else if (is.promise(effect)) {
      return ['promise', effect]
    } else if (is.iterator(effect)) {
      return ['iterator', effect]
    } else if (is.array(effect)) {
      return effect
    } else {
      const error = new Error('Unable to normalize effect')
      error.effect = effect
      currCb(error, true)
    }
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

  function cancel() {
    if (task.isRunning && !task.isCancelled) {
      task.isCancelled = true
      taskQueue.cancelAll()
      end(TASK_CANCEL)
    }
  }

  function end(result, isErr) {
    task.isRunning = false
    if (!isErr) {
      task.result = result
      task._deferredEnd && task._deferredEnd.resolve(result)
    } else {
      task.error = result
      task.isAborted = true
      task._deferredEnd && task._deferredEnd.reject(result)
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
    return {
      toPromise() {
        if (this._deferredEnd) {
          return this._deferredEnd.promise
        }

        const def = deferred()
        this._deferredEnd = def

        if (!this.isRunning) {
          if (this.isAborted) {
            def.reject(this.error)
          } else {
            def.resolve(this.result)
          }
        }
        return def.promise
      },
      cont,
      joiners: [],
      cancel,
      isRunning: true,
      isCancelled: false,
      isAborted: false,
      result: undefined,
      error: undefined,
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
    if (fn.test) {
      debugger
    }
    const iterator = createTaskIterator(fn, args)
    try {
      suspend()
      const subTask = proc(iterator, ctx, noop)
      if (subTask.isRunning) {
        taskQueue.addTask(subTask)
        cb(subTask)
      } else if (subTask.error) {
        taskQueue.abort(subTask.error)
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
      cb(proc(iterator, ctx, noop))
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
