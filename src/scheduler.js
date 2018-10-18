const queue = []
let semaphore = 0

function suspend() {
  semaphore++
}

function release() {
  semaphore--
}

function flush() {
  release()

  while (semaphore === 0 && queue.length > 0) {
    const task = queue.shift()
    try {
      suspend()
      task()
    } finally {
      release()
    }
  }
}

export function asap(task) {
  queue.push(task)
  if (semaphore === 0) {
    suspend()
    flush()
  }
}

export function immediately(task) {
  try {
    suspend()
    return task()
  } finally {
    flush()
  }
}
