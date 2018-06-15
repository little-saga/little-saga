import { Env, identity } from '..'
import compatEnhancer from './compatEnhancer'
import { multicastChannel } from '../channelEffects/index'

export default function createSagaMiddleware(cont) {
  function middleware({ dispatch, getState }) {
    const channel = multicastChannel()
    const env = new Env(cont)
      .use(compatEnhancer)
      .use(ctx => {
        ctx.channel = channel.connect(dispatch)
      })
      .def('select', ([_type, selector = identity, ...args], _ctx, cb) =>
        cb(selector(getState(), ...args)),
      )

    middleware.run = (...args) => env.run(...args)

    return next => action => {
      const result = next(action) // hit reducers
      channel.put(action)
      return result
    }
  }

  middleware.run = (...args) => {
    throw new Error(
      'Before running a Saga, you must mount the Saga middleware on the Store using applyMiddleware',
    )
  }

  return middleware
}
