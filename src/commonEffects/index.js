import all from './all'
import race from './race'
import { apply, call, cps, delayEffectRunner, getContext, setContext } from './other'

const map = new Map([
  ['all', all],
  ['race', race],
  ['apply', apply],
  ['call', call],
  ['cps', cps],
  ['delay', delayEffectRunner],
  ['getContext', getContext],
  ['setContext', setContext],
])

export default function commonEffects(ctx) {
  const last = ctx.translator
  ctx.translator = {
    getRunner(effect) {
      const effectType = effect[0]
      if (map.has(effectType)) {
        return map.get(effectType)
      } else {
        return last.getRunner(effect)
      }
    },
  }
}
