import { identity, PrimaryEnv } from '..'
import { multicastChannel } from '../channelEffects/index'

const connectChannelWithDispatch = dispatch => ctx => (ctx.channel = ctx.channel.connect(dispatch))

function createSelectEffectRunner(getState) {
  return function runSelectEffect([_type, selector = identity, ...args], _ctx, cb) {
    return cb(selector(getState(), ...args))
  }
}

export default function createSagaMiddleware(cont) {
  function middleware({ dispatch, getState }) {
    const channel = multicastChannel()

    const env = new PrimaryEnv(cont)
      .use(connectChannelWithDispatch(dispatch))
      .def('select', createSelectEffectRunner(getState))

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
