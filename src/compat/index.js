import { delay, io } from '..'
import compatEnhancer from './compatEnhancer'
import createSagaMiddleware from './middleware'
import { buffers, channel, eventChannel } from '../channelEffects'
import { takeEvery, takeLatest, takeLeading, throttle } from './helpers'

// little-saga specific APIs
export { compatEnhancer }

// ------ 以下为 redux-saga 的 API ------
// API 可以参考官方文档  https://redux-saga.js.org/docs/api/
// 在 little-saga 中未实现的 API 会在下方写明

// Middleware API
export default createSagaMiddleware

// Saga Helpers
export { takeEvery, takeLeading, takeLatest, throttle }

// Effect creators
export const take = io.take
take.maybe = io.takeMaybe
export const put = io.put
// put.resolve is NOT supported in little-saga
export const call = io.call
export const apply = io.apply
export const cps = io.cps
export const fork = io.fork
export const spawn = io.spawn
export const join = io['enhanced-join']
export const cancel = io['enhanced-cancel']
export const select = io.select
export const actionChannel = io.actionChannel
export const flush = io.flush
export const cancelled = io.cancelled
export const setContext = io.setContext
export const getContext = io.getContext

// Effect combinator
export const all = io.all
export const race = io.race

// Interfaces & External API are NOT supported in little-saga

// Utils
export {
  channel,
  eventChannel,
  buffers,
  delay,
  // The following utils are NOT supported in little-saga
  // cloneableGenerator(generatorFunc)
  // createMockTask()
}
