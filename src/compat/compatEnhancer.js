import commonEffects from '../commonEffects'
import channelEffects from '../channelEffects'

export default function compatEnhancer(ctx) {
  commonEffects(ctx)
  channelEffects(ctx)

  const last = ctx.translator
  ctx.translator = {
    ...last,
    getRunner(effect) {
      const effectType = effect[0]
      if (effectType === 'enhanced-join') {
        return runEnhancedJoinEffect
      } else if (effectType === 'enhanced-cancel') {
        return runEnhancedCancelEffect
      } else {
        return last.getRunner(effect)
      }
    },
  }
}

function runEnhancedJoinEffect([effectType, ...otherTasks], ctx, cb, { digestEffect }) {
  if (otherTasks.length > 1) {
    digestEffect(['all', otherTasks.map(t => ['join', t])], cb)
  } else {
    const singleTask = otherTasks[0]
    digestEffect(['join', singleTask], cb)
  }
}

function runEnhancedCancelEffect([effectType, ...cancelling], ctx, cb, { digestEffect }) {
  if (cancelling.length > 1) {
    digestEffect(['all', cancelling.map(t => ['cancel', t])], cb)
  } else {
    digestEffect(['cancel', cancelling[0]], cb)
  }
}
