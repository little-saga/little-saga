[![Build Status](https://img.shields.io/travis/little-saga/little-saga/master.svg?style=flat-square)](https://travis-ci.org/little-saga/little-saga) [![NPM Package](https://img.shields.io/npm/v/little-saga.svg?style=flat-square)](https://www.npmjs.org/package/little-saga)

## little-saga

little-saga 是 redux-saga 的简化版本，主要功能和 redux-saga 保持一致。little-saga 去掉了一些不常用的特性，并使用了更现代化的 JavaScript 进行编写（要求 node >= 8.3）。little-saga 的初衷是希望通过简化源代码，让更多人了解 redux-saga 背后的原理，详情请戳 [👉 炒鸡详细的介绍 redux-saga/little-saga 原理的文章](docs/building-your-own-redux-saga.md)。

如果你的项目中用到了 redux，那么你应该使用 redux-saga 来作为 redux 的中间件，redux-saga 有着更完善的测试和文档。如果你没有使用 redux，而是希望拥有一个 saga runtime，并使用 fork-model 和 channel 来管理你的异步代码，那么 little-saga 也许是不错的选择。

## API 文档

little-saga 的 API 与 redux-saga 稍微有些不一样。little-saga API 请以下面的文档为准。

**注意：API 文档仍在施工中。**

### createSagaMiddleware

```javascript
import { createSagaMiddleware } from 'little-saga'

const sagaMiddleware = createSagaMiddleware(options)
// 将 sagaMiddleware 作为 redux 的中间件之一，并创建 store
sagaMiddleware.run(saga, ...args)
```

该函数用于创建 sagaMiddleware，注意其引入方式和 redux-saga 中的不一样。`sagaMiddleware.run` 的底层仍然是调用了 runSaga 函数，故其参数 options 和 runSaga 的一致。

使用 createSagaMiddleware 时，请不要提供 options.dispatch 和 options.getState，这两个字段会由 store 进行提供。

### runSaga

```javascript
import { runSaga } from 'little-saga'
const rootTask = runSaga(options, saga, ...args)
```

启动 saga 函数，返回一个 Task 对象用来描述 saga 的运行状态。参数 saga 是一个生成器函数，参数 args 将被传递给 saga 参数。参数 options 可以用来对 saga 运行环境进行配置。options 中每个字段都是可选的，具体如下：

| 字段名                | 作用                                                         |
| --------------------- | ------------------------------------------------------------ |
| taskContext           | root task 的初始 context，saga 运行过程中可以通过 getContext/setContext effect 来存取该 context 对象。 |
|                       | taskContext 默认值为 `{}`                                    |
| cont                  | root task 的后继（continuation）。当 root task 完成时（或出错时），cont 将被调用，调用形式为 `cont(result, isErr)`，result 表示 root task 返回的结果或是发生的错误，isErr 表示 result 是否错误对象。 |
|                       | cont 默认值为 `reportErrorOnly`：如果发生错误的话，该函数会打印错误，否则会忽略正常返回的结果。 |
| channel               | saga 运行时执行 put/take 的默认 channel。                    |
|                       | channel 默认值为 `stdChannel()`，即一个全新的 stdChannel 实例。也可以传入一个自定义的 channel 来替换默认值，使得 saga 连接到外部的输入输出。详见下方「使用 stdChannel」 |
| customEffectRunnerMap | 自定义 effect runner 映射表。用于定义额外的 effect 类型，使得 saga 运行时可以使用自定义类型得 effect。详见下方「使用自定义 effect 类型」 |
|                       | customEffectRunnerMap 默认值为 `{}`                          |
| customEnv             | 默认值为 `{}`。详见下方「使用自定义 effect 类型」            |
| dispatch              | 如果提供该字段的话，该字段将替换 channel.put 成为 put-effect 的回调函数。即每次用户执行 `yield put(xxx)` 时，dispatch 将会被调用，调用形式为 `dispatch(xxx)`。 |
|                       | 该字段默认为空。在默认情况下，put/take effect 将使用默认的底层 channel 进行通信。 |
|                       | 使用 createSagaMiddleware 时，用户不需要提供该字段，该字段由 store.dispatch 提供。 |
| getState              | 用于定义 select-effect 的回调函数。即每次用户执行 `yield select()` 时，getState 将会被调用，调用形式为 `getState()` |
|                       | 只要不使用 select-effect，该字段便是可选的。使用 createSagaMiddleware 时，用户不需要提供该字段，该字段由 store.getState 提供。 |

### effect 创建器

little-saga 中的创建器和 redux-saga 保持一致，具体详见 redux-saga 文档。注意在 little-saga 中 effect 创建器都位于 io 对象中，需要引入 io 对象才能使用这些创建器。

```javascript
import { io } from 'little-saga'

function* genFn() {
  yield io.call(fn1, ...args1)
  yield io.race({
    foo: io.cps(cb => {
      /* ... */
    }),
    bar: io.join(task1),
  })
  yield io.fork(gen2, ...args2)
}
```

little-saga 部分 effect 创建器的接口与 redux-saga 目前版本(v1.0.0-beta.1)不同，使用了[redux-saga#1527](https://github.com/redux-saga/redux-saga/pull/1527) 中的实现方式。具体差别如下：

- join 多个任务对象的使用方式变为 `io.join([...tasks])`
- cancel 多个任务对象的使用方式变为 `io.cancel([...tasks])`

### 工具函数与 saga 辅助函数

little-saga 提供的工具函数和 redux-saga 中的一致，详见 redux-saga 文档：

- [`channel([buffer])`](https://redux-saga-in-chinese.js.org/docs/api/index.html#channelbuffer)
- [`eventChannel(subscribe, [buffer])`](https://redux-saga-in-chinese.js.org/docs/api/index.html#eventchannelsubscribe-buffer-matcher)
- [`buffers`](https://redux-saga-in-chinese.js.org/docs/api/index.html#buffers)
- [`delay(ms, [val])`](https://redux-saga-in-chinese.js.org/docs/api/index.html#delayms-val)

辅助函数包括：takeEvery / takeLeading / takeLatest / throttle / debounce

这五个辅助函数与 redux-saga 中的一致，详见 redux-saga 文档。（注：debounce 将会在 redux-saga v1 中加入）

## 使用 stdChannel

stdChannel 是一种特殊的 multicastChannel，我们可以创建新的 stdChannel 实例，并使用它来连接外部输入输出。

`stdChannel.enhancePut(enhancer)` 参数 enhancer 是一个函数，用于「提升该 stdChannel 的 put 方法」。enhancer 接受原来的 put，并返回一个新的 put 来代替原来的 put。

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

## 使用自定义 effect 类型

在下面这个简单的例子中，我们定义了类型为 `'NOW'` 的 effect。

```javascript
import { runSaga, makeEffect } from 'little-saga'

const customEffectRunnerMap = {
  // 定义 NOW 类型的 effect-runner
  NOW: (payload, cb) => {
    // 使用 cb 来决定 yield 的返回值
    cb(new Date())
  },
}

function saga() {
  // 使用 makeEffect 来创建 NOW 类型的 effect
  // 参数 payload 可以是任意值，该参数将会传递给对应的 effect-runner
  const date = yield makeEffect('NOW', payload)
}

runSaga({ customEffectRunnerMap }, saga)
```

### 函数 makeEffect

`makeEffect(type, payload)` 用于创建 effect 对象。

- 参数 type 表示 effect 类型，一般为大写字符串。注意创建自定义的 effect 时，避免使用 TAKE / ALL / SELECT 等内置的类型。
- 参数 payload 可以为任意值，该参数将会被传递给自定义的 effect-runner。

### effectRunner 参数说明

customEffectRunnerMap 为自定义 effect runner 映射表。effectRunner 被调用时，调用形式如下：

```javascript
effectRunner(payload, cb, { task, env, runEffect })
```

🚧 **表示一般来说不应该或是不需要用到的 API**

* payload 为 effect 的参数，来自于调用 makeEffect 时的 payload 参数
* cb 是一个回调函数。当 effect 完成时，我们需要执行 `cb(result)` 将结果传递给生成器（result 的值即为 yield 语句的返回值）。当发生错误时，我们需要执行 `cb(error, true)` 以将错误抛给生成器。
* task 是当前的 Task 对象：
  * task.taskContext 是当前 task 的 context
  * 🚧 task.taskQueue 是当前 task 的 ForkQueue，记录了该 Task fork 了哪些 child-task，这个 child-task 以及 mainTask 的运行状态。
* env 是 saga 的运行环境，运行环境在 runSaga 被调用时即被创建，所有运行的 saga 共享同一个 env 对象。
  * env.channel：  saga 运行时执行 put/take 的默认 channel
  * env.getState：  调用 runSaga 时提供的 getState 参数
  * 🚧 env.effectRunnerMap：  内置与自定义两部分 effectRunnerMap 合并之后的结果
  * env 对象也包括了调用 runSaga 时提供的 customEnv 对象中的各个字段。
* runEffect 用于在当前执行环境下执行其他 effect，其调用形式如下：`digestEffect(otherEffect, cb)`
  * otherEffect 为想要执行的其他 effect
  * cb 为 otherEffect 执行完成时的回调函数

所有的内置类型的 effect 也是通过上述 API 进行实现的，在实现自定义 effect 时可以参考 [内置类型的实现代码](/src/coreEffectRunnerMap.js)。