import { TASK_CANCEL } from './symbols'

export default class MainTask {
  // cont will be set when passed to forkQueue
  cont = null

  isRunning = true
  isCancelled = false

  constructor(next) {
    this.next = next
  }

  cancel = () => {
    if (this.isRunning && !this.isCancelled) {
      this.isCancelled = true
      this.next(TASK_CANCEL)
    }
  }
}
