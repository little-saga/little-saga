import { Callback, Effect, Task, TaskContext } from './index'

export * from './sagaHelpers'
export * from './channelEffects'
export * from './index'

export function compatEnhancer(ctx: TaskContext): void

export default function createSagaMiddleware(
  cont?: Callback,
): {
  (middlewareAPI: any): (next: any) => (action: any) => any
  run?(fn: Function, ...args: any[]): Task
}

interface EffectCreator {
  <A = any, B = any, C = any, D = any, E = any>(...args: any[]): Effect
  [key: string]: any
}

export const take: EffectCreator
export const put: EffectCreator
export const call: EffectCreator
export const apply: EffectCreator
export const cps: EffectCreator
export const fork: EffectCreator
export const spawn: EffectCreator
export const join: EffectCreator
export const cancel: EffectCreator
export const select: EffectCreator
export const actionChannel: EffectCreator
export const flush: EffectCreator
export const cancelled: EffectCreator
export const setContext: EffectCreator
export const getContext: EffectCreator
export const all: EffectCreator
export const race: EffectCreator
