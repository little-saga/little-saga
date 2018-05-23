import { asap, is } from '..'
import { SAGA_ACTION } from './channel'

export default function connectToEmitter(emitter) {
  return ctx => {
    const channelPut = ctx.channel.put
    ctx.channel.put = action => {
      if (is.object(action) || is.array(action)) {
        action[SAGA_ACTION] = true
      }
      emitter.emit('action', action)
    }

    emitter.on('action', action => {
      if (action[SAGA_ACTION]) {
        channelPut(action)
      } else {
        asap(() => channelPut(action))
      }
    })
  }
}
