## v0.5.1 (unreleased)

- scheduler 重构：移除 suspend/flush 函数，新增 immediately 函数
- root-saga 启动时使用 immediately 进行调度
- 不再导出 scheduler 相关 API

## v0.5.0

- setContext 函数的参数形式变更为 `setContext(prop: string, value: any)`

## v0.4

详见 https://zhuanlan.zhihu.com/p/39705084

v0.4 版本基本上和 redux-saga 保持一致，差别主要在于 little-saga 省略了部分不常用的功能（例如 effectMiddleware、sagaMonitor 等）
