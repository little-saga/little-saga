[![Build Status](https://img.shields.io/travis/little-saga/little-saga/master.svg?style=flat-square)](https://travis-ci.org/little-saga/little-saga) [![NPM Package](https://img.shields.io/npm/v/little-saga.svg?style=flat-square)](https://www.npmjs.org/package/little-saga)

## little-saga v0.6

从 v0.6 开始，little-saga 的定位变为 **通用的、可嵌入的 saga 运行环境**。little-saga 的概念和 API 仍与 redux-saga 保持一致，但 little-saga 的应用场景与 redux-saga 不同。

[点击这里](https://github.com/little-saga/little-saga/tree/v0.5.4) 查看 v0.5.x 版本。

## React hooks

[`@little-saga/use-saga`](https://github.com/little-saga/use-saga)：使用 React hooks 特性在一个组件的生命周期内运行 little-saga。推荐配合该类库在 React 组件中使用 little-saga 😊

## API 列表

little-saga 的提供的 API 与 redux-saga 基本上一致，但仍然需要注意两者的差别。

### `runSaga`

```javascript
import { runSaga } from 'little-saga'

const rootTask = runSaga(options, fn, ...args)
```

启动 saga，返回一个 `Task` 对象用来描述 saga 的运行状态。参数 `fn` 是一个生成器函数，参数 `args` 将被传递给该生成器函数。参数 `options` 可以用来对 saga 运行环境进行配置。

`options` 中所有字段 **都是可选的**，每个字段的含义如下：

| 字段名      | 默认值                                                                            | 含义                                                                                                                                                                                                    |
| ----------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| scheduler   | `defaultScheduler`: 一个全局共享的调度器实例                                      | saga 运行环境所使用的调度器；一般情况下不需要提供该参数 <br/> 详见 「[使用 stdChannel](/docs/using-stdchannel.md)」                                                                                     |
| taskContext | `{}`                                                                              | root task 的初始 context <br/>saga 运行过程中可以通过 getContext/setContext effect 来存取该 context 对象。                                                                                              |
| channel     | `stdChannel()`: 一个全新 stdChannel 实例                                          | saga 运行时执行 put/take 的默认 channel <br/> 可以传入一个自定义的 stdChannel 实例来替换默认值，使得 saga 连接到外部的输入输出。详见「[使用 stdChannel](/docs/using-stdchannel.md)」                    |
| customEnv   | `{}`                                                                              | 添加到 saga 运行环境对象 `env` 中的额外字段 <br/>saga 运行时通过 `yield io.getEnv()` 可以获取到 `customEnv`                                                                                             |
| getState    | `undefined`                                                                       | 定义 select-effect 的回调函数 <br/>每次执行 `yield io.select()` 时，`getState` 将会被调用，调用形式为 `getState()`                                                                                      |
| setState    | `undefined`                                                                       | 定义 update-effect 的回调函数 <br/>每次执行 `yield io.update()` 时该函数将被调用，用于更新状态                                                                                                          |
| cont        | `reportErrorOnly`：如果发生错误的话，该函数会打印错误，否则会忽略正常返回的结果。 | root task 的后继（continuation）<br/>当 root task 完成时（或出错时），cont 将被调用，调用形式为 `cont(result, isErr)`，result 表示 root task 返回的结果或是发生的错误，isErr 表示 result 是否错误对象。 |

### effect 类型与 effect 创建器

little-saga 默认所支持的 effect 类型和 redux-saga 基本一致，每个 effect 类型的具体含义详见 redux-saga 文档。

在 little-saga，effect 创建器位于 `io` 对象中，我们需要引入 `io` 对象才能使用这些创建器。

```javascript
import { io } from 'little-saga'

function* genFn() {
  yield io.call(fn)
  yield io.put({ type: 'ACTION' })
}
```

little-saga 支持的 effect 创建具体列表如下：

- `io.fork(fn, ...args)`
- `io.spawn(fn, ...args)`
- `io.join(task)`
- `io.join([task1, task2, ...])`
- `io.cancel(task)`
- `io.cancel([task1, task2, ...])`
- `io.cancelled()`
- `io.all([effect1, effect2, ...])`
- `io.race([effect1, effect2, ...])`
- `io.cps(fn, ...args)`
- `io.call(fn, ...args)`
- `io.apply(context, fn, ...args)`
- `io.setContext(prop, value)`
- `io.getContext(prop)`
- `io.getEnv()`
- `io.select(selector)`
- `io.update(value)`
- `io.update(updater, ...args)`
- `io.take(pattern)`
- `io.take(channel, pattern)`
- `io.takeMaybe(pattern)`
- `io.takeMaybe(channel, pattern)`
- `io.put(action)`
- `io.put(channel, action)`
- `io.flush(channel)`
- `io.actionChannel(pattern)`

注意事项：

- `io.all` 和 `io.race` 也支持使用 _对象_ 作为参数
- `io.fork / io.spawn / io.cps / io.call` 的签名均为 `io.xxx(fn, ...args)`，它们也同时支持以下调用方式：
  - `io.xxx([context, method], ...args)`
  - `io.xxx([context, methodName], ...args)`
  - `io.xxx({ context, fn: method }, ...args)`
  - `io.xxx({ context, fn: methodName }, ...args)`
- `io.setContext` 的接口在 little-saga 中为 `io.setContext(prop, value)`，与 redux-saga 中不一样
- little-saga 移除了 `io.putResolve`
- little-saga 新增了 `io.getEnv()`
- little-saga 新增了 `io.update()`

### `io.getEnv()`

`GET_ENV` effect 用于获取 `env` 对象中的字段。当 saga 运行在某个特定环境下时（例如运行在某个 React 组件的生命周期内），我们可以通过 `runSaga#options.customEnv` 在 `env` 对象设置某些字段，然后在 saga 中使用 `GET_ENV` effect 可以访问这些字段。

执行 `yield io.getEnv()` 会直接返回 `env` 对象，在 saga 中请不要对该对象进行任何修改。该对象包含了如下字段：

- `getState`：select-effect 的回调函数
- `channel`：执行 put/take 的默认 channel
- `scheduler`：saga 运行环境所使用的调度器
- 以及来自 `runSaga#options.customEnv` 对象所提供的所有字段

### `io.update()`

`UPDATE` effect 用于更新状态，io.update 支持两种不同的调用方式：

- `io.update(nextValue)`：将状态更新为 `nextValue`
- `io.update(updater, ...args)`：使用 updater 来更新状态。updater 是一个函数，被调用的形式为 `updater(state, ...args)`，`updater(...)` 的返回值将作为新的状态。

### channels & buffers

little-saga 提供相关函数和 redux-saga 中的基本一致.

- [`channel([buffer])`](https://redux-saga-in-chinese.js.org/docs/api/index.html#channelbuffer)
- [`eventChannel(subscribe, [buffer])`](https://redux-saga-in-chinese.js.org/docs/api/index.html#eventchannelsubscribe-buffer-matcher)
- [`buffers`](https://redux-saga-in-chinese.js.org/docs/api/index.html#buffers)
- `multicastChannel()`：该函数用于创建一个多播的消息队列。同一时刻可以存在多个 taker 挂起在一个多播的消息队列上，当一个消息出现时，所有的 taker 都将被同时唤醒。多播的消息队列没有缓存，当一个消息出现时，如果没有对应的 taker，该消息将被丢弃。
- `stdChannel()`：该函数用于创建一个特殊的多播队列，作为 runSaga 的参数。详见「[使用 stdChannel](/docs/using-stdchannel.md)」

### 通用工具函数

little-saga 导出了一部分通用的函数，详情可见[源码](/src/utils.js)。

- `delay(ms, [val])`：创建一个在 `ms` 毫秒之后被 resolve 的 Promise 对象，且其 resolved value 为 `val`，`val` 的默认值为 `true`.
- `deferred([props])`：使用 Promise 创建一个延迟对象，延迟对象包含三个字段：`promise / resolve / reject`。`resolve` / `reject` 可用于手动修改 `promise` 的状态.
- `identity(val)`：返回参数自身的函数.
- `noop`：忽略参数，不执行任何操作的函数.
- `always(val)`：返回一个 _永远返回 `val` 的函数_.
- `once(fn)`：接受一个 _不接受参数的函数 `fn`_，返回一个 `fn'`。`fn'` 会在第一次被调用的时候调用 `fn`，后续调用 `fn'` 将不会产生任何效果.
- `remove(array, item)`：从数组中移除特定元素.
- `is`：该对象包含了若干方法，用于判断一个参数是否为相应的数据类型.
- `makeMatcher(pattern)`：根据 pattern 来创建相应的匹配函数，该函数被用于实现 `io.take(pattern)` 的匹配功能.

### saga 辅助函数

辅助函数包括：`takeEvery / takeLeading / takeLatest / throttle / debounce`

这五个辅助函数与 redux-saga 中的一致，详见 redux-saga 文档 (￣ ▽ ￣)

### `makeScheduler()`

创建一个新的调度器实例，用于作为 `runSaga` 的选项或是 `stdChannel` 的参数。一般情况下用不到该函数。

```javascript
import { makeScheduler } from 'little-saga'

const scheduler = makeScheduler()
const channel = stdChannel(scheduler)

runSaga({ scheduler, channel }, saga, ...args)
```

## 相关文档

[使用 stdChannel](/docs/using-stdchannel.md)
