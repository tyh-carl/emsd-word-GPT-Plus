import log from 'loglevel'

const level = (import.meta.env.VITE_LOG_LEVEL as log.LogLevelDesc) || 'trace'
log.setLevel(level)

export default log
