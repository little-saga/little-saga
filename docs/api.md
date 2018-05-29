**API 文档仍在施工中。**

## 与 redux-saga 不一致的地方

* little-saga 比较简单，仅保留了 redux-saga 中常用的 API，使用时请注意 API 差别。
* 当被用作 redux 中间件时，little-saga 只能作为唯一的中间件。
* `fork` 不能被用来执行普通函数（非生成器函数），例如 `yield fork(delay, 200)` 是没有效果的。（原因见下方 FAQ）

## 使用 little-saga

首先确定 redux-saga 是否可以满足你的需求。如果满足的话，那么就用 redux-saga。否则请继续往下看。

阅读 little-saga 核心部分源码：[/src/core/](/src/core) 目录以及 [/src/utils.js](/src/utils.js)，代码总共大约 400 行。

**TODO**

## FAQ

#### 1. 为什么 fork 不能用来执行普通函数？

在 redux-saga 中，当 redux-saga 发现普通函数 `fn` 被 fork 时，会将其转换为 `fn$` （转换这个词不是很精确，但大致意思是一致的）。转换的情况如下：

```javascript
function fn(a, b) {
  /* do something */
  return value
}

function* fn$(a, b) {
  /* do something */
  return yield value
}
```

redux-saga 遇到不认识的 `value` 被 yield 时，会将其原样返回（作为 yield 表达式的返回值）。little-saga 要求所有被 yield 的值都是合法的 effect，因为不能确保上面代码中 `value` 一定是合法的 effect，所以 little-saga **不会**进行 `fn` 到 `fn$` 的转换。
