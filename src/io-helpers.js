import { IO } from './symbols'

export function makeEffect(type, payload) {
  return { [IO]: true, type, payload }
}

export function detach({ type, payload }) {
  return makeEffect(type, { ...payload, detached: true })
}
