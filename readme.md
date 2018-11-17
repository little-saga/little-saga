[![Build Status](https://img.shields.io/travis/little-saga/little-saga/master.svg?style=flat-square)](https://travis-ci.org/little-saga/little-saga) [![NPM Package](https://img.shields.io/npm/v/little-saga/next.svg?style=flat-square)](https://www.npmjs.org/package/little-saga)

## little-saga v0.6

从 v0.6 开始，little-saga 的定位变为 **通用的、可嵌入的 saga 运行环境**。little-saga 的概念和 API 仍与 redux-saga 保持一致，但 little-saga 的应用场景与 redux-saga 不同。

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
| getState    | `undefined`                                                                       | 定义 select-effect 的回调函数 <br/>每次执行 `yield select()` 时，`getState` 将会被调用，调用形式为 `getState()`                                                                                         |
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

### `io.getEnv()`

`GET_ENV` effect 用于获取 `env` 对象中的字段。当 saga 运行在某个特定环境下时（例如运行在某个 React 组件的生命周期内），我们可以通过 `runSaga#options.customEnv` 在 `env` 对象设置某些字段，然后在 saga 中使用 `GET_ENV` effect 可以访问这些字段。

执行 `yield io.getEnv()` 会直接返回 `env` 对象，在 saga 中请不要对该对象进行任何修改。该对象包含了如下字段：

- `getState`：select-effect 的回调函数
- `channel`：执行 put/take 的默认 channel
- `scheduler`：saga 运行环境所使用的调度器
- 以及来自 `runSaga#options.customEnv` 对象所提供的所有字段

### TODO `makeScheduler()`

### channels & buffers

little-saga 提供的工具函数和 redux-saga 中的一致，详见 redux-saga 文档：

- [`channel([buffer])`](https://redux-saga-in-chinese.js.org/docs/api/index.html#channelbuffer)
- [`eventChannel(subscribe, [buffer])`](https://redux-saga-in-chinese.js.org/docs/api/index.html#eventchannelsubscribe-buffer-matcher)
- [`buffers`](https://redux-saga-in-chinese.js.org/docs/api/index.html#buffers)
- TODO `multicastChannel`
- TODO `stdChannel`

### 通用工具函数

TODO identity, deferred, delay, noop, always, once, is, remove, makeMatcher

- [`delay(ms, [val])`](https://redux-saga-in-chinese.js.org/docs/api/index.html#delayms-val)

### saga 辅助函数

辅助函数包括：takeEvery / takeLeading / takeLatest / throttle / debounce

这五个辅助函数与 redux-saga 中的一致，详见 redux-saga 文档 (￣ ▽ ￣)

## 相关文档

[使用 stdChannel](/docs/using-stdchannel.md)
