import createSagaMiddleware, { put, select } from '../../src/compat'

function applyMiddleware(...middlewares) {
  function compose(...funcs) {
    return arg => funcs.reduceRight((composed, f) => f(composed), arg)
  }

  return next => (reducer, initialState) => {
    const store = next(reducer, initialState)
    let dispatch
    const chain = middlewares.map(middleware =>
      middleware({
        getState: store.getState,
        dispatch: action => dispatch(action),
      }),
    )
    dispatch = compose(...chain)(store.dispatch)

    return { ...store, dispatch }
  }
}

function createStore(reducer, initialState) {
  const currentReducer = reducer
  let currentState = initialState
  const listeners = []

  function getState() {
    return currentState
  }

  function dispatch(action) {
    currentState = currentReducer(currentState, action)
    listeners.slice().forEach(listener => listener())
    return action
  }

  dispatch({ type: '@@redux/INIT' })

  return { dispatch, getState }
}

test('a simple counter example using redux', () => {
  const sagaMiddleware = createSagaMiddleware()
  const enhancedCreateStore = applyMiddleware(sagaMiddleware)(createStore)
  function reducer(state = { count: 0 }, action) {
    if (action.type === 'inc') {
      return { count: state.count + 1 }
    } else if (action.type === 'dec') {
      return { count: state.count - 1 }
    } else {
      return state
    }
  }

  expect(() => {
    sagaMiddleware.run(function*() {
      yield select()
    })
  }).toThrow(
    'Before running a Saga, you must mount the Saga middleware on the Store using applyMiddleware',
  )

  const store = enhancedCreateStore(reducer)

  const actual = []

  sagaMiddleware.run(function*() {
    actual.push(yield select()) // count: 0
    yield put({ type: 'inc' }) // 0 -> 1
    actual.push(yield select()) // count: 1
    yield put({ type: 'inc' }) // 1 -> 2
    yield put({ type: 'inc' }) // 2 -> 3
    actual.push(yield select()) // count: 3

    yield put({ type: 'other' })
    yield put({ type: 'other-again' })
    yield put(['some', 'array'])
    yield put(1234)

    yield put({ type: 'dec' }) // 3 -> 2
    actual.push(yield select()) // count: 2
  })

  store.dispatch({ type: 'dec' }) // 2 -> 1
  actual.push(store.getState()) // count: 1

  expect(actual).toEqual([{ count: 0 }, { count: 1 }, { count: 3 }, { count: 2 }, { count: 1 }])
})
