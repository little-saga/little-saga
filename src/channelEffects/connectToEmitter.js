export default function connectToEmitter(emitter, event = 'action') {
  return ctx => {
    const channel = ctx.channel
    ctx.channel = channel.connect(action => emitter.emit(event, action))
    emitter.on(event, action => channel.put(action))
  }
}
