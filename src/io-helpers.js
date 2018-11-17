import { makeEffect } from './internal-utils'

export function detach({ type, payload }) {
  return makeEffect(type, { ...payload, detached: true })
}
