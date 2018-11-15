## 使用自定义 effect 类型

(从我自己的使用经验来看，自定义 effect 类型用起来相当费劲 😰。各位请酌情使用。)

自定义 effect 类型是一个非常灵活的机制，允许我们定义新的 effect 类型并为其指定相应的 effect runner。我们在 effect runner 中能够使用一些较为底层的 API，故该机制也能用于实现一些较为底层的功能。little-saga 默认的 effect 用的也是同样的 effect runner 接口，故自定义类型和默认类型并没有什么本质区别。

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

function* saga() {
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

⚠️ **表示一般来说不应该或是不需要用到的 API**

- payload 为 effect 的参数，来自于调用 makeEffect 时的 payload 参数
- cb 是一个回调函数。当 effect 完成时，我们需要执行 `cb(result)` 将结果传递给生成器（result 的值即为 yield 语句的返回值）。当发生错误时，我们需要执行 `cb(error, true)` 以将错误抛给生成器。
- task 是当前的 Task 对象：
  - task.taskContext 是当前 task 的 context
  - ⚠️ task.taskQueue 是当前 task 的 ForkQueue，记录了该 Task fork 了哪些 child-task，这个 child-task 以及 mainTask 的运行状态。
- env 是 saga 的运行环境，运行环境在 runSaga 被调用时即被创建，所有运行的 saga 共享同一个 env 对象。
  - env.channel： saga 运行时执行 put/take 的默认 channel
  - env.getState： 调用 runSaga 时提供的 getState 参数
  - ⚠️ env.effectRunnerMap： 内置与自定义两部分 effectRunnerMap 合并之后的结果
  - env 对象也包括了调用 runSaga 时提供的 customEnv 对象中的各个字段。
- runEffect 用于在当前执行环境下执行其他 effect，其调用形式如下：`digestEffect(otherEffect, cb)`
  - otherEffect 为想要执行的其他 effect
  - cb 为 otherEffect 执行完成时的回调函数

所有的内置类型的 effect 也是通过上述 API 进行实现的，在实现自定义 effect 时可以参考 [内置类型的实现代码](/src/coreEffectRunnerMap.js)。
