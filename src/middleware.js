import runSaga from './runSaga'
import { stdChannel } from './channel-utils/channels'

export default function createSagaMiddleware(options = {}) {
  function middleware({ dispatch, getState }) {
    const { channel = stdChannel(), ...otherOptions } = options
    const runSagaOptions = Object.assign({ dispatch, getState, channel }, otherOptions)
    middleware.run = (...args) => runSaga(runSagaOptions, ...args)

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
