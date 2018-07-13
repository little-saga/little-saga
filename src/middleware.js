import { stdChannel } from './channel-utils/channels'
import runSaga from './runSaga'
import { reportErrorOnly } from './internal-utils'

export default function createSagaMiddleware({
  ctx = {},
  cont = reportErrorOnly,
  channel = stdChannel(),
  customEffectRunnerMap = {},
} = {}) {
  function middleware({ dispatch, getState }) {
    const options = {
      ctx,
      cont,
      channel,
      customEffectRunnerMap,
      dispatch,
      getState,
    }
    middleware.run = (...args) => runSaga(options, ...args)

    return next => action => {
      const result = next(action) // hit reducers
      channel.put(action)
      return result
    }
  }

  middleware.run = () => {
    throw new Error(
      'Before running a Saga, you must mount the Saga middleware on the Store using applyMiddleware',
    )
  }

  return middleware
}
