const createError = require('http-errors')
const express = require('express')
const session = require('express-session')
const path = require('path')
const logger = require('morgan')

const indexRouter = require('./routes/index')
const fedcmRouter = require('./routes/fedcm')
const authRouter = require('./routes/auth_router')

// IDP Metadata
const IDPMetadata = require('./idp_metadata.json')

// RP Metadata
const clientMetaData = require('./client_metadata.json')

const app = express()

// Set up middleware
app.use(express.urlencoded({ extended: false }))

app.use(
  session({
    secret: 'mysecret', // replace with your own secret
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.HEROKU_APP_NAME ? false : true
    }
  })
)

// Define a constant for the supported hostnames
const supportedIDPOrigins = Object.keys(IDPMetadata)

// Create an in-memory user map for each hostname
// This allows us to store users for each IDP separately in memory
const users = supportedIDPOrigins.reduce((acc, hostname) => {
  acc[hostname] = new Map()
  return acc
}, {})

// Use middleware to set the correct user map based on the hostname and the client metadata
app.use((req, res, next) => {
  const hostname = req.hostname
  console.log('hostname', hostname)
  const isLocalhost =
    req.hostname === 'localhost' || req.hostname === '127.0.0.1'
  const port = isLocalhost ? `:${req.socket.localPort}` : ''
  const baseUrl = `${req.protocol}://${req.hostname}${port}`
  const metadata = IDPMetadata[hostname]

  // Add users to the req object based on the hostname (i.e. IDP)
  req.users = users[hostname]
  req.clientMetaData = clientMetaData

  // Add supportedIDPOrigins to the req object
  req.supportedIDPOrigins = supportedIDPOrigins

  // Add IDPMetadata to the req object
  //req.IDPMetadata = IDPMetadata[hostname]
  req.IDPMetadata = JSON.parse(
    JSON.stringify(metadata).replace('{baseUrl}', baseUrl)
  )
  console.log('req.IDPMetadata', req.IDPMetadata)
  next()
})

// View engine setup
app.set('views', 'views')
app.set('view engine', 'ejs')

app.use(logger('dev'))
app.use(express.json())
app.use(express.static(path.join(__dirname, 'public')))

// Set up routes
app.use('/api/auth', authRouter)
app.use('/', indexRouter)
app.use('/fedCM/', fedcmRouter)

// Catch 404 and forward to error handler
app.use((req, res, next) => {
  next(createError(404))
})

// Error handler
app.use((err, req, res, next) => {
  // Set locals, only providing error in development
  res.locals.message = err.message
  res.locals.error = req.app.get('env') === 'development' ? err : {}

  // Render the error page
  res.status(err.status || 404)
  res.render('error', { title: 'Error', error: err })
})

module.exports = app
