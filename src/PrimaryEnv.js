import { Env } from '.'
import commonEffects from './commonEffects'
import channelEffects from './channelEffects'

export default class PrimaryEnv extends Env {
  constructor(cont) {
    super(cont)
    commonEffects(this.ctx)
    channelEffects(this.ctx)
  }
}
