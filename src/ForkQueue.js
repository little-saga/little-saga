import { noop, remove } from './utils'

export default class ForkQueue {
  tasks = []
  result = undefined
  completed = false

  // cont will be set after calling constructor()
  cont = undefined

  constructor(mainTask) {
    this.mainTask = mainTask
    this.addTask(this.mainTask)
  }

  abort(err) {
    this.cancelAll()
    this.cont(err, true)
  }

  addTask(task) {
    this.tasks.push(task)
    task.cont = (res, isErr) => {
      if (this.completed) {
        return
      }

      remove(this.tasks, task)
      task.cont = noop
      if (isErr) {
        this.abort(res)
      } else {
        if (task === this.mainTask) {
          this.result = res
        }
        if (this.tasks.length === 0) {
          this.completed = true
          this.cont(this.result)
        }
      }
    }
  }

  cancelAll() {
    if (this.completed) {
      return
    }
    this.completed = true
    this.tasks.forEach(t => {
      t.cont = noop
      t.cancel()
    })
    this.tasks = []
  }
}
