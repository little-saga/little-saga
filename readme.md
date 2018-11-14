[![Build Status](https://img.shields.io/travis/little-saga/little-saga/master.svg?style=flat-square)](https://travis-ci.org/little-saga/little-saga) [![NPM Package](https://img.shields.io/npm/v/little-saga.svg?style=flat-square)](https://www.npmjs.org/package/little-saga)

## little-saga

little-saga 是 redux-saga 的简化版本，主要功能和 redux-saga 保持一致。little-saga 去掉了一些不常用的特性，并使用了更现代化的 JavaScript 进行编写（要求 node >= 8.3）。little-saga 的初衷是希望通过简化源代码，让更多人了解 redux-saga 背后的原理，详情请戳 [👉 炒鸡详细的介绍 redux-saga/little-saga 原理的文章](docs/building-your-own-redux-saga.md)。

如果你的项目中用到了 redux，那么你应该使用 redux-saga 来作为 redux 的中间件，redux-saga 有着更完善的测试和文档。如果你没有使用 redux，而是希望拥有一个 saga runtime，并使用 fork-model 和 channel 来管理你的异步代码，那么 little-saga 是个不错的选择。

## API 文档

little-saga 的 API 与 redux-saga 稍微有些不一样。little-saga API 请以下面的文档为准。

### `createSagaMiddleware`

```javascript
import { createSagaMiddleware } from 'little-saga'

const sagaMiddleware = createSagaMiddleware(options)
// 将 sagaMiddleware 作为 redux 的中间件之一，并创建 store
sagaMiddleware.run(saga, ...args)
```

该函数用于创建 saga 的 redux 中间件，需要注意的是该函数的引入方式和 redux-saga 中的不一样。`sagaMiddleware.run` 的底层仍然是调用了 `runSaga` 函数，故参数 `options` 和 `runSaga` 的一致。

### `runSaga`

```javascript
import { runSaga } from 'little-saga'
const rootTask = runSaga(options, saga, ...args)
```

启动 saga，返回一个 `Task` 对象用来描述根任务的运行状态。参数 `saga` 是一个生成器函数，参数 `args` 将被传递给该生成器函数。参数 `options` 可以用来对 saga 运行环境进行配置。`options` 中所有字段 **都是可选的**，每个字段的含义如下：

| 字段名                | 作用                                                                                                                                                                                                 |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| taskContext           | root task 的初始 context，saga 运行过程中可以通过 getContext/setContext effect 来存取该 context 对象。                                                                                               |
|                       | taskContext 默认值为 `{}`                                                                                                                                                                            |
| cont                  | root task 的后继（continuation）。当 root task 完成时（或出错时），cont 将被调用，调用形式为 `cont(result, isErr)`，result 表示 root task 返回的结果或是发生的错误，isErr 表示 result 是否错误对象。 |
|                       | cont 默认值为 `reportErrorOnly`：如果发生错误的话，该函数会打印错误，否则会忽略正常返回的结果。                                                                                                      |
| channel               | saga 运行时执行 put/take 的默认 channel。                                                                                                                                                            |
|                       | channel 默认值为 `stdChannel()`，即一个全新的 stdChannel 实例。也可以传入一个自定义的 channel 来替换默认值，使得 saga 连接到外部的输入输出。详见「[使用 stdChannel](/docs/using-stdchannel.md)」     |
| customEffectRunnerMap | 自定义 effect runner 映射表。用于定义额外的 effect 类型，使得 saga 运行时可以使用自定义类型得 effect。详见「[使用自定义 effect 类型](/docs/using-customized-effects.md)」                            |
|                       | customEffectRunnerMap 默认值为 `{}`                                                                                                                                                                  |
| customEnv             | 默认值为 `{}`。详见「[使用自定义 effect 类型](/docs/using-customized-effects.md)」                                                                                                                   |
| dispatch              | 如果提供该字段的话，该字段将替换 channel.put 成为 put-effect 的回调函数。即每次用户执行 `yield put(xxx)` 时，dispatch 将会被调用，调用形式为 `dispatch(xxx)`。                                       |
|                       | 该字段默认为空。在默认情况下，put/take effect 将使用默认的底层 channel 进行通信。                                                                                                                    |
|                       | 使用 createSagaMiddleware 时，请不要提供该字段，该字段由 `store.dispatch` 提供。                                                                                                                     |
| getState              | 用于定义 select-effect 的回调函数。即每次用户执行 `yield select()` 时，getState 将会被调用，调用形式为 `getState()`                                                                                  |
|                       | 在不使用 select-effect 的情况下，该字段是可选的。使用 createSagaMiddleware 时，请不要提供该字段，该字段由 `store.getState` 提供。                                                                    |

### effect 创建器

little-saga 默认所支持的 effect 类型和 redux-saga 基本一致（不一致的情况见下方备注），具体详见 redux-saga 文档。在 little-saga，effect 创建器位于 `io` 对象中，我们需要引入 `io` 对象才能使用这些创建器。

```javascript
import { io } from 'little-saga'

function* genFn() {
  yield io.call(fn1, ...args1)
  yield io.all([effect1, effect2])
  yield io.fork(gen2, ...args2)
}
```

**备注:** `setContext` 的接口在 little-saga 中为 `io.setContext(prop: string, value: any)`

### 额外的 effect 类型

`GET_ENV` effect 用于获取 `env` 对象中的字段。当 saga 运行在某个特定环境下时（例如运行在某个 React 组件的生命周期内），我们可以通过 `runSaga#options.customEnv` 在 `env` 对象设置某些字段，然后在 saga 中使用 `GET_ENV` effect 可以访问这些字段。

执行 `yield io.getEnv()` 会直接返回 `env` 对象，在 saga 中请不要对该对象进行任何修改。

### 工具函数

little-saga 提供的工具函数和 redux-saga 中的一致，详见 redux-saga 文档：

- [`channel([buffer])`](https://redux-saga-in-chinese.js.org/docs/api/index.html#channelbuffer)
- [`eventChannel(subscribe, [buffer])`](https://redux-saga-in-chinese.js.org/docs/api/index.html#eventchannelsubscribe-buffer-matcher)
- [`buffers`](https://redux-saga-in-chinese.js.org/docs/api/index.html#buffers)
- [`delay(ms, [val])`](https://redux-saga-in-chinese.js.org/docs/api/index.html#delayms-val)

### 辅助函数

辅助函数包括：takeEvery / takeLeading / takeLatest / throttle / debounce

这五个辅助函数与 redux-saga 中的一致，详见 redux-saga 文档 (￣ ▽ ￣)

## 其他 API 文档

[使用自定义 effect 类型](/docs/using-customized-effects.md)

[使用 stdChannel](/docs/using-stdchannel.md)
