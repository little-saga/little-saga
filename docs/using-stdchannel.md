## 使用 `stdChannel`

`stdChannel` 是一种特殊的 `multicastChannel`，我们可以创建新的 `stdChannel` 实例，并使用它来连接外部输入输出。

`stdChannel.enhancePut(enhancer)` 参数 `enhancer` 是一个函数，用于「提升该 stdChannel 的 put 方法」。`enhancer` 接受原来的 put，并返回一个新的 put 来代替原来的 put。

`enhancePut` 可以用来作为 stdChannel 的「中间件」，例如下面这个例子中，我们使用该方法来处理 put 数组的情况：

```javascript
import { stdChannel, runSaga, io } from 'little-saga'

const chan = stdChannel()
chan.enhancePut(put => {
  return action => {
    if (Array.isArray(action)) {
      action.forEach(put)
    } else {
      put(action)
    }
  }
})

function* saga() {
  // 在 chan 应用了上述的 enhancer 之后，我们可以直接 put 一个数组
  yield io.put([action1, action2, action3])
  // 等价于下面的写法
  // yield io.put(action1)
  // yield io.put(action2)
  // yield io.put(action3)
}

runSaga({ channel: chan }, saga)
```

`enhancerPut` 也能够用于连接外部输入输出，下面的例子中展示了如何使用该方法连接到 EventEmitter：

```javascript
const emitter = new EventEmitter()

// 将 channel 连接到 emitter 的 'saga' 事件类型上
const chan = stdChannel().enhancePut(put => {
  // 当 emitter 激发 'saga' 事件时，调用 put 将事件负载派发到 channel 上
  emitter.on('saga', put)
  // 返回一个「新的 put」用作 put-effect 的处理函数
  // 当我们 yield 一个 put-effect 时，emitter 将激发一个 'saga' 事件
  return action => emitter.emit('saga', action)
})

runSaga({ channel: chan }, saga)
```

注意，调用 `enhancerPut` 会直接改变 `channel.put` 字段，所以**应该总是用 `channel.put` 的形式来调用 put 方法。**

```javascript
const chan = stdChannel()
const put1 = chan.put // 不要这么做，因为调用 enhancePut 之后 chan.put 就会指向新的对象
```
