import _ from 'lodash'
import classNames from 'classnames'
import React, { Component } from 'react'
import { connect } from 'react-redux'
import { tokenizer } from 'acorn'
import actions, { saveGist } from '../actions/actions.js'
import bios from '../iframe/src/utils/bios.js'
import screenTypes, {
  getPreviousScreen,
  getNextScreen
} from '../iframe/src/utils/screenTypes.js'
import canRecord from '../utils/canRecord.js'
import isBlank from '../utils/isBlank.js'
import { getLintErrors } from '../utils/setupLinter.js'
import { numberWithCommas } from '../utils/string.js'
import { assembleOrderedGame } from '../iframe/src/gistParsers/game.js'
import { version } from '../iframe/package.json'
import getGameTitle from '../utils/getGameTitle'

const mapStateToProps = ({
  screen,
  game,
  songs,
  chains,
  phrases,
  sprites,
  map,
  sound,
  gist,
  token,
  tutorial
}) => ({
  songs,
  chains,
  phrases,
  sprites,
  map,
  game: screen === screenTypes.BOOT ? { 0: { text: bios } } : game,
  run: [screenTypes.BOOT, screenTypes.RUN].includes(screen),
  screen,
  sound,
  gist,
  token,
  tutorial
})

const mapDispatchToProps = dispatch => ({
  setScreen: screen => dispatch(actions.setScreen(screen)),
  finishBoot: () => dispatch(actions.finishBoot()),
  saveGist: ({ game, token, gist, sprites, map, phrases, chains, songs }) =>
    dispatch(
      saveGist({
        game,
        token,
        gist,
        sprites,
        map,
        phrases,
        chains,
        songs,
        toBlank: false
      })
    )
})

const getTokenCount = game => {
  const src = assembleOrderedGame(game)
  try {
    return numberWithCommas([...tokenizer(src)].length)
  } catch (error) {
    return 'ERROR'
  }
}
const throttledTokenCount = _.throttle(getTokenCount, 1000)

class Output extends Component {
  constructor(props) {
    super(props)

    this.evaluate = this.evaluate.bind(this)
    this.handleClickSize = this.handleClickSize.bind(this)
    this.resize = _.debounce(this.resize.bind(this), 100)
    this.handleBlur = this.handleBlur.bind(this)

    window.addEventListener('resize', this.resize)

    this.useFrameBufferRenderer = false

    this.state = {
      showSize: false,
      errors: [],
      log: null
    }
  }

  noop() {}

  resize() {
    if (this.isLoaded) {
      this.evaluate()
    }
  }

  handleClickSize() {
    this.setState({
      showSize: !this.state.showSize
    })
  }

  handleBlur(e) {
    if (this.props.run) {
      e.currentTarget.focus()
    }
  }

  componentDidMount() {
    this._iframe.focus()

    const { search } = window.location
    const params = new window.URLSearchParams(search)
    const renderer = params.get('renderer')
    if (renderer && renderer === 'framebuffer') {
      this.useFrameBufferRenderer = true
    }
  }

  componentDidUpdate(prevProps) {
    if (this.props.run) {
      this._iframe.focus()
    }
    if (this.isLoaded) {
      this.evaluate()
    }
    if (
      assembleOrderedGame(this.props.game) !==
      assembleOrderedGame(prevProps.game)
    ) {
      this.setState({
        log: null
      })
    }
  }

  componentWillUnmount() {
    window.removeEventListener('resize', this.resize)
  }

  evaluate() {
    const {
      game,
      finishBoot,
      run,
      songs,
      chains,
      phrases,
      sprites,
      map,
      screen,
      sound,
      gist,
      setScreen,
      saveGist,
      token
    } = this.props

    // Create a closured function for eval'ing the game.
    const sendPayload = (callbacks = {}) => {
      const channel = new window.MessageChannel()
      if (this._iframe) {
        const blank = isBlank({ game, sprites, map, phrases, chains, songs })
        const gistIsEmpty = _.isEmpty(gist)
        this._iframe.contentWindow.postMessage(
          {
            type: 'callCode',
            game: assembleOrderedGame(game),
            isDoneFetching:
              screen === screenTypes.BOOT && !gist.isFetching && gist.data,
            songs,
            chains,
            phrases,
            sprites,
            map,
            run,
            callbacks,
            sound,
            isNew: blank && gistIsEmpty,
            useFrameBufferRenderer: this.useFrameBufferRenderer
          },
          '*',
          [channel.port2]
        )
        channel.port1.onmessage = e => {
          if (e.data.callback === 'finishBoot') {
            finishBoot()
          }
          const { height, errors, log, shortcut } = e.data
          if (height && this._iframe) {
            this._iframe.height = height
          }
          if (errors) {
            this.setState({ errors })
          }
          if (!_.isNil(log)) {
            this.setState({ log })
          }
          if (shortcut) {
            if (shortcut === 'save') {
              // If we're logged in,
              // and we can save,
              if (token.value && canRecord(this.props)) {
                // save.
                saveGist(this.props)
              }
            }
            if (shortcut === 'previous') {
              setScreen(getPreviousScreen(screen))
            }
            if (shortcut === 'next') {
              setScreen(getNextScreen(screen))
            }
          }
        }
      }
    }

    // If we're on the boot screen,
    // ignore validation.
    if (screen === screenTypes.BOOT) {
      sendPayload({
        endCallback: 'finishBoot'
      })
    } else {
      // Validate code before drawing.
      getLintErrors({
        text: assembleOrderedGame(game)
      }).then(errors => {
        if (!errors.length) {
          sendPayload()
        } else {
          // If we had errors, print them to console.
          console.warn(errors[0].message)
        }
      })
    }
  }

  render() {
    const { errors, log } = this.state
    const { run, tutorial, game } = this.props
    const gameTitle = getGameTitle(game)
    document.title = [gameTitle, 'SCRIPT-8'].filter(d => d).join(' - ')

    const tokenCount = throttledTokenCount(game)

    const iframeUrl =
      process.env.NODE_ENV !== 'production'
        ? process.env.REACT_APP_IFRAME_URL
        : `${process.env.REACT_APP_IFRAME_URL}/iframe-v${version}.html`

    return (
      <div
        className={classNames('Output', {
          'in-tutorial': tutorial && run
        })}
      >
        <iframe
          src={iframeUrl}
          title="SCRIPT-8"
          sandbox="allow-scripts allow-same-origin"
          onBlur={this.handleBlur}
          ref={_iframe => {
            this._iframe = _iframe
          }}
          onLoad={() => {
            this.isLoaded = true
            this.evaluate()
          }}
        />
        {!run ? (
          <div className="errors-and-stats">
            {!_.isNil(log) ? (
              <div className="log">log: {JSON.stringify(log)}</div>
            ) : null}
            <ul className="errors">
              {errors.map(({ type, message }) => (
                <li key={type}>error: {message}</li>
              ))}
            </ul>
            <div className="stats">TOKENS: {tokenCount}</div>
          </div>
        ) : null}
      </div>
    )
  }
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(Output)
