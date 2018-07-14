[![Build Status](https://img.shields.io/travis/little-saga/little-saga/master.svg?style=flat-square)](https://travis-ci.org/little-saga/little-saga) [![NPM Package](https://img.shields.io/npm/v/little-saga.svg?style=flat-square)](https://www.npmjs.org/package/little-saga)

# little-saga

little-saga 是 redux-saga 的简化版本，主要功能和 redux-saga 保持一致。little-saga 去掉了一些不常用的特性，并使用了更现代化的 JavaScript 进行编写（要求 node >= 8.3）。little-saga 的初衷是希望通过简化源代码，让更多人了解 redux-saga 背后的原理，详情请戳 [👉 炒鸡详细的介绍 redux-saga/little-saga 原理的文章](docs/building-your-own-redux-saga.md)。

## API 文档

little-saga 的 API 与 redux-saga 稍微有些不一样。little-saga API 请以下面的文档为准。

**注意：API 文档仍在施工中。**

#### runSaga

`runSaga(options, fn, ...args)`

