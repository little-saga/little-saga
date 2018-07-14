[![Build Status](https://img.shields.io/travis/little-saga/little-saga/master.svg?style=flat-square)](https://travis-ci.org/little-saga/little-saga) [![NPM Package](https://img.shields.io/npm/v/little-saga.svg?style=flat-square)](https://www.npmjs.org/package/little-saga)

# little-saga

little-saga 是 redux-saga 的简化版本，主要功能和 redux-saga 保持一致。little-saga 去掉了一些不常用的特性，并使用了更现代化的 JavaScript 进行编写（要求 node >= 8.3）。little-saga 的初衷是希望通过简化源代码，让更多人了解 redux-saga 背后的原理，详情请戳 [👉 炒鸡详细的介绍 redux-saga/little-saga 原理的文章](docs/building-your-own-redux-saga.md)。

如果你的项目中用到了 redux，那么你应该使用 redux-saga 来作为 redux 的中间件，redux-saga 有着更完善的测试和文档。如果你没有使用 redux，而是希望拥有一个 saga runtime，使用 fork-model 和 channel 来管理你的异步代码，那么你可以使用 little-saga。

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

| 字段名                    | 作用                                                                                                                                                                                                 |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| taskContext               | root task 的初试 context，saga 运行过程中可以通过 getContext/setContext effect 来存取该 context 对象。                                                                                               |
|                           | taskContext 默认值为 `{}`                                                                                                                                                                            |
| cont                      | root task 的后继（continuation）。当 root task 完成时（或出错时），cont 将被调用，调用形式为 `cont(result, isErr)`，result 表示 root task 返回的结果或是发生的错误，isErr 表示 result 是否错误对象。 |
|                           | cont 默认值为 `reportErrorOnly`：如果发生错误的话，该函数会打印 root task 中发生的错误，否则会忽略正常返回的结果。                                                                                   |
| channel                   | saga 运行时执行 put/take 的默认 channel。                                                                                                                                                            |
|                           | channel 默认值为 `stdChannel()`，即一个全新的 stdChannel 实例。也可以传入一个自定义的 channel 来替换默认值，使得 saga 连接到外部的输入输出。详见下方「stdChannel」                                   |
| ~~customEffectRunnerMap~~ | 自定义 effect runner 映射表。用于定义额外的 effect 类型，使得 saga 运行时可以使用自定义类型得 effect。                                                                                               |
|                           | customEffectRunnerMap 默认值为 `{}`                                                                                                                                                                  |
|                           | customEffectRunnerMap 暂时还无法使用 \_(:з」∠)\_                                                                                                                                                     |
| dispatch                  | 如果提供该字段的话，该字段将替换 channel.put 成为 put-effect 的回调函数。即每次用户执行 `yield put(xxx)` 时，dispatch 将会被调用，调用形式为 `dispatch(xxx)`。                                       |
|                           | 该字段默认为空。在默认情况下，put/take effect 将使用默认的底层 channel 进行通信。                                                                                                                    |
|                           | 使用 createSagaMiddleware 时，用户不需要提供该字段，该字段由 store.dispatch 提供。                                                                                                                   |
| getState                  | 用于定义 select-effect 的回调函数。即每次用户执行 `yield select()` 时，getState 将会被调用，调用形式为 `getState()`                                                                                  |
|                           | 只要不使用 select-effect，该字段便是可选的。使用 createSagaMiddleware 时，用户不需要提供该字段，该字段由 store.getState 提供。                                                                       |

## Effect 创建器

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

little-saga 的 effect 创建器和 redux-saga 中的一样，具体详见 redux-saga 文档。注意 little-saga 中需要导入 io 对象才能使用 effect 创建器。

### Saga 辅助函数

该部分包括了以下五个辅助函数：takeEvery / takeLeading / takeLatest / throttle / debounce

这五个辅助函数与 redux-saga 中的一样，详见 redux-saga 文档。（注：debounce 将会在 redux-saga v1 中加入）

### 工具

和 redux-saga 中的一致，详见 redux-saga 文档：

- [`channel([buffer])`](https://redux-saga-in-chinese.js.org/docs/api/index.html#channelbuffer)
- [`eventChannel(subscribe, [buffer], matcher)`](https://redux-saga-in-chinese.js.org/docs/api/index.html#eventchannelsubscribe-buffer-matcher)
- [`buffers`](https://redux-saga-in-chinese.js.org/docs/api/index.html#buffers)
- [`delay(ms, [val])`](https://redux-saga-in-chinese.js.org/docs/api/index.html#delayms-val)

### stdChannel

构建自定义的 stdChannel 实例来连接外部输入输出。TODO
