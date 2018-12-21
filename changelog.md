little-saga 在一些功能上会和 redux-saga 保持同步，🔗 表示在 redux-saga 中的相关 pull request

## (unreleased)

## v0.6.1 (unreleased)

- 新增 io.update

## v0.6.0

- 移除 redux 中间件
- 调度器不再使用全局单例，而是可以在启动 saga 运行环境时进行指定
- 移除自定义 effect 类型

## v0.5.4

- 新增 GET_ENV effect
- 导出 makeMatcher 函数

## v0.5.1

- scheduler 重构：移除 suspend/flush 函数，新增 immediately 函数 [🔗#1641](https://github.com/redux-saga/redux-saga/pull/1641)
- root-saga 启动时使用 immediately 进行调度 [🔗#1628](https://github.com/redux-saga/redux-saga/pull/1628)
- 不再导出 scheduler 相关 API

## v0.5.0

- setContext 函数的参数形式变更为 `setContext(prop: string, value: any)`
- 修复 actionChannel 在关闭之后的内存泄露问题 [🔗#1606](https://github.com/redux-saga/redux-saga/pull/1606)

## v0.4.x

- 该版本基本上和 redux-saga 保持一致，差别主要在于 little-saga 省略了部分不常用的功能（例如 effectMiddleware、sagaMonitor 等）
- 详见 https://zhuanlan.zhihu.com/p/39705084
