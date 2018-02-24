import { createActions } from 'redux-actions'
import GitHub from 'github-api'
import _ from 'lodash'
import actionTypes from './actionTypes.js'

const actions = createActions({
  [actionTypes.SET_SCREEN]: screen => screen,
  [actionTypes.FETCH_GIST_REQUEST]: () => {},
  [actionTypes.FETCH_GIST_SUCCESS]: data => data,
  [actionTypes.FINISH_BOOT]: () => {},
  [actionTypes.UPDATE_GAME]: game => game,
  [actionTypes.TOKEN_REQUEST]: () => {},
  [actionTypes.TOKEN_SUCCESS]: data => data,
  [actionTypes.SET_NEXT_ACTION]: action => action,
  [actionTypes.CLEAR_NEXT_ACTION]: () => {},
  [actionTypes.SAVE_GIST_REQUEST]: () => {},
  [actionTypes.SAVE_GIST_SUCCESS]: data => data
})

export default actions

export const fetchGist = id => dispatch => {
  dispatch(actions.fetchGistRequest())

  return window
    .fetch(`https://my-service-aprcdrtrnj.now.sh/${id}`)
    .then(
      response => response.json(),
      error => console.log('An error occurred.', error)
    )
    .then(json => dispatch(actions.fetchGistSuccess(json)))
}

export const fetchToken = code => dispatch => {
  dispatch(actions.tokenRequest())

  return window
    .fetch(`${process.env.REACT_APP_AUTHENTICATOR}/authenticate/${code}`)
    .then(
      response => response.json(),
      error => console.log('An error occurred.', error)
    )
    .then(({ token }) => {
      const gh = new GitHub({ token })

      return gh
        .getUser()
        .getProfile()
        .then(
          response => ({
            token,
            user: response.data
          }),
          error => console.log('An error occurred.', error)
        )
    })
    .then(json => dispatch(actions.tokenSuccess(json)))
}

export const saveGist = ({ game, token, gist }) => dispatch => {
  dispatch(actions.saveGistRequest())

  const gh = new GitHub({
    token: token.value
  })

  const preparePayload = () => ({
    public: true,
    description: 'SCRIPT-8',
    files: {
      'code.js': {
        content: game
      }
    }
  })

  const createGist = () =>
    gh
      .getGist()
      .create(preparePayload())
      .then(
        response => response.data,
        error => console.log('An error occurred.', error)
      )
      .then(data => dispatch(actions.saveGistSuccess(data)))

  const updateGist = () =>
    gh
      .getGist(gist.data.id)
      .update(preparePayload())
      .then(
        response => response.data,
        error => console.log('An error occurred.', error)
      )
      .then(data => dispatch(actions.saveGistSuccess(data)))

  // If there is no gist, create it.
  if (!gist.data) {
    return createGist()
  } else {
    // If there is a gist, and it is ours,
    if (_.get(gist, 'data.owner.login', null) === token.user.login) {
      // update it.
      return updateGist()
    } else {
      // If it is not ours, create it.
      return createGist()
    }
  }
}
