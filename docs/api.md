**API 文档仍在施工中。**

## 与 redux-saga 不一致的地方

* little-saga 比较简单，移除了 redux-saga 中一些非常少用的 API (todo 移除了哪些 API？)。
* 当被用作 redux 中间件时，little-saga 只能作为唯一的中间件。
* `call/fork` 不能被用来执行普通函数（非生成器函数），例如 `yield call(delay, 200)` 是没有效果的。请使用 `yield delay(200)` 代替 `yield call(delay, 200)`。

## 使用 little-saga 的正确方式

首先确定 redux-saga 是否可以满足你的需求。如果满足的话，那么就用 redux-saga。否则请继续往下看。

**TODO**