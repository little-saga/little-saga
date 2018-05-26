export const TASK_CANCEL: unique symbol
export const CANCEL: unique symbol

export class Env {
  cont: Callback
  ctx: TaskContext
  constructor(cont?: (result: any, isErr: boolean) => void)
  use(enhancer: TaskContextEnhancer): this
  def(type: string, handler: EffectRunner): this
  run(fn: Function, ...args: any[]): Task
}

export function proc(iterator: Iterator<any>, parentContext: TaskContext, cont: Callback): Task

export function asap(task: () => void): void
export function suspend(): void
export function flush(): void

export function identity<T>(arg: T): T
export interface DeferredEnd<T> {
  promise?: Promise<T>
  resolve?(result: T): void
  reject?(error: any): void
  [key: string]: any
}
export function deferred(props?: {}): DeferredEnd<any>
export function delay(ms: number, val?: boolean): Promise<{}>
export const noop: () => void
export const kTrue: () => boolean
export function once(fn: () => void): () => void
export const is: {
  func: (f: any) => f is Function
  number: (n: any) => n is number
  string: (s: any) => s is string
  symbol: (s: any) => s is symbol
  array: (arg: any) => arg is any[]
  object: (obj: any) => boolean
  promise: (p: any) => p is Promise<any>
  iterator: (it: any) => it is Iterator<any>
  channel: (ch: any) => boolean
}
export function remove<T>(array: T[], item: T): void
export interface IO {
  [key: string]: {
    (...args: any[]): Effect
    [key: string]: any
  }
}
export const io: IO
export function def(ctx: TaskContext, type: string, handler: EffectRunner): void

export type Effect = any[]

export interface Callback<T = any> {
  (result?: T | Error, isErr?: boolean): void
  cancel?(): void
}

export interface EffectTranslator {
  getRunner(effect: Effect): EffectRunner
}

export interface TaskContext {
  translator?: EffectTranslator
  channel?: any
}

export type TaskContextEnhancer = (ctx: TaskContext) => void

export type EffectRunner = (
  effect: Effect,
  ctx: TaskContext,
  cb: Callback,
  internalApis?: EffectRunnerInternalApis,
) => void

export interface EffectRunnerInternalApis {
  digestEffect(effect: Effect, cb: Callback): void
}

declare global {
  interface Promise<T> {
    [CANCEL]?: () => void
  }
}

export interface Task {
  isRunning: boolean
  isCancelled: boolean
  isAborted: boolean
  result: any
  error: any
  cancel: () => void
  toPromise(): Promise<any>
}
