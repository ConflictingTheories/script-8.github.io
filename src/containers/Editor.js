import React from 'react'
import { connect } from 'react-redux'
import CodeEditor from '../components/CodeEditor.js'
import Output from '../components/Output.js'
import Menu from '../components/Menu.js'
import PropTypes from 'prop-types'
import actions from './../actions/actions.js'

const mapStateToProps = ({ game }) => ({
  game
})

const mapDispatchToProps = dispatch => ({
  onUpdate: update => dispatch(actions.updateGame(update))
})
    // <Output game={game} />

const Editor = ({ game, onUpdate }) => (
  <div className='Editor'>
    <Menu />
    <CodeEditor game={game} onUpdate={onUpdate} />
  </div>
)

Editor.propTypes = {
  game: PropTypes.string,
  onUpdate: PropTypes.func.isRequired
}

export default connect(mapStateToProps, mapDispatchToProps)(Editor)