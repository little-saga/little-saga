export default function def(ctx, type, handler) {
  const old = ctx.translator
  ctx.translator = {
    getRunner(effect) {
      return effect[0] === type ? handler : old.getRunner(effect)
    },
  }
}
