import runSaga from './runSaga'
import { stdChannel } from './channel-utils/channels'

export default function createSagaMiddleware(options = {}) {
  let boundRunSaga
  function middleware({ dispatch, getState }) {
    const { channel = stdChannel(), ...otherOptions } = options
    const runSagaOptions = { dispatch, getState, channel, ...otherOptions }

    boundRunSaga = runSaga.bind(null, runSagaOptions)

    return next => action => {
      const result = next(action) // hit reducers
      channel.put(action)
      return result
    }
  }

  middleware.run = (...args) => {
    if (!boundRunSaga) {
      throw new Error(
        'Before running a Saga, you must mount the Saga middleware on the Store using applyMiddleware',
      )
    }
    return boundRunSaga(...args)
  }

  return middleware
}
