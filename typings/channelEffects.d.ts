import { TaskContextEnhancer } from './index'

declare const commonEffectsContextEnhancer: TaskContextEnhancer
export default commonEffectsContextEnhancer

export const END: unique symbol
export const MATCH: unique symbol
export const SAGA_ACTION: unique symbol

export const buffers: {
  none<T>(): Buffer<T>
  fixed<T>(limit?: number): Buffer<T>
  dropping<T>(limit?: number): Buffer<T>
  sliding<T>(limit?: number): Buffer<T>
  expanding<T>(limit?: number): Buffer<T>
}

export interface Buffer<T> {
  isEmpty(): boolean
  put(message: T): void
  take(): T | undefined
  flush(): T[]
}

export function connectToEmitter(emitter: NodeJS.EventEmitter, key?: string): TaskContextEnhancer

export interface Channel<T> {
  take(cb: (message: T | typeof END) => void): void
  put(message: T | typeof END): void
  flush(cb: (items: T[] | typeof END) => void): void
  close(): void
}
export function channel<T>(buffer?: Buffer<T>): Channel<T>

export interface EventChannel<T> {
  take(cb: (message: T | typeof END) => void): void
  flush(cb: (items: T[] | typeof END) => void): void
  close(): void
}
export type Subscribe<T> = (cb: (input: T | typeof END) => void) => () => void
export function eventChannel<T>(subscribe: Subscribe<T>, buffer?: Buffer<T>): EventChannel<T>

export type Predicate<T> = (arg: T) => boolean
export interface MulticastChannel<T> {
  take(cb: (message: T | typeof END) => void, matcher?: Predicate<T>): void
  put(message: T | typeof END): void
  close(): void
  lift<PUT extends (action: T | typeof END) => void>(fn: (put: PUT) => PUT): this
  clone(): this
  connect(dispatch: (action: T | typeof END) => void): this
}
export function multicastChannel<T>(): MulticastChannel<T>
