import { IO, SELF_CANCELLATION } from './symbols'
import { is } from './utils'
import { resolveContextAndFn } from './internal-utils'

export function makeEffect(type, payload) {
  return { [IO]: true, type, payload }
}

export function detach({ type, payload }) {
  return {
    type,
    payload: { ...payload, detached: false },
  }
}

function applyEffectCreator(context, fn, ...args) {
  return makeEffect('CALL', { ...resolveContextAndFn({ context, fn }), args })
}

function takeEffectCreatorFactory(maybe) {
  return (channel, pattern) => {
    if (!is.channel(channel)) {
      pattern = channel
      channel = undefined
    }
    return makeEffect('TAKE', { channel, pattern, maybe })
  }
}

function putEffectCreatorFactory(resolve) {
  return (channel, action) => {
    if (!is.channel(channel)) {
      action = channel
      channel = undefined
    }
    return makeEffect('PUT', { channel, action, resolve })
  }
}

const io = {
  fork: (fn, ...args) => makeEffect('FORK', { fn, args, detached: false }),
  spawn: (fn, ...args) => detach(io.fork(fn, ...args)),
  join: taskOrTasks => makeEffect('JOIN', taskOrTasks),
  cancel: (taskOrTasks = SELF_CANCELLATION) => makeEffect('CANCEL', taskOrTasks),
  cancelled: () => makeEffect('CANCELLED'),
  all: effects => makeEffect('ALL', effects),
  race: effects => makeEffect('RACE', effects),
  cps: (fn, ...args) => makeEffect('CPS', { ...resolveContextAndFn(fn), args }),
  call: (fn, ...args) => makeEffect('CALL', { ...resolveContextAndFn(fn), args }),
  apply: applyEffectCreator,
  setContext: partialContext => makeEffect('SET_CONTEXT', partialContext),
  getContext: prop => makeEffect('GET_CONTEXT', prop),
  select: (selector, ...args) => makeEffect('SELECT', { selector, args }),
  take: takeEffectCreatorFactory(false),
  takeMaybe: takeEffectCreatorFactory(true),
  put: putEffectCreatorFactory(false),
  putResolve: putEffectCreatorFactory(true),
  flush: chan => makeEffect('FLUSH', chan),
  actionChannel: (pattern, buffer) => makeEffect('ACTION_CHANNEL', { pattern, buffer }),
}

export default io
