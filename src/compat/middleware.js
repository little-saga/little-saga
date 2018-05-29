import { asap, Env, identity, is } from '..'
import compatEnhancer from './compatEnhancer'
import { SAGA_ACTION } from '../channelEffects/index'

export default function createSagaMiddleware(cont) {
  function middleware({ dispatch, getState }) {
    let channelPut
    const env = new Env(cont)
      .use(compatEnhancer)
      .use(ctx => {
        channelPut = ctx.channel.put
        ctx.channel.put = action => {
          if (is.object(action) || is.array(action)) {
            action[SAGA_ACTION] = true
          }
          dispatch(action)
        }
      })
      .def('select', ([_type, selector = identity, ...args], _ctx, cb) =>
        cb(selector(getState(), ...args)),
      )

    middleware.run = (...args) => env.run(...args)

    return next => action => {
      const result = next(action) // hit reducers
      if (action[SAGA_ACTION]) {
        channelPut(action)
      } else {
        asap(() => channelPut(action))
      }
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
