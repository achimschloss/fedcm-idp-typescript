const createError = require('http-errors')
const express = require('express')
const session = require('express-session')
const path = require('path')
const logger = require('morgan')

const indexRouter = require('./routes/index')
const fedcmRouter = require('./routes/fedcm')
const authRouter = require('./routes/auth_router')

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

// IDP Metadata

// Define a constant for the supported hostnames
const supportedIDPOrigins = [
  'idp-a-test.de',
  'idp-b-test.de',
  ...(process.env.HEROKU_APP_NAME && process.env.HEROKU_APP_NAME !== 'localhost'
    ? [process.env.HEROKU_APP_NAME + '.herokuapp.com']
    : []),
  'localhost'
]

// Create an in-memory user map for each hostname
// This allows us to store users for each IDP separately in memory
const users = supportedIDPOrigins.reduce((acc, hostname) => {
  acc[hostname] = new Map()
  return acc
}, {})

// IDP Metadata

const baseConfig = {
  accounts_endpoint: '/fedcm/accounts_endpoint',
  client_metadata_endpoint: '/fedcm/client_metadata_endpoint',
  id_assertion_endpoint: '/fedcm/token_endpoint',
  revocation_endpoint: '/fedcm/revocation_endpoint'
}

const IDPMetadata = {
  'idp-a-test.de': {
    ...baseConfig,
    branding: {
      background_color: 'rgb(255, 255, 204)',
      color: '0xffffff',
      icons: [
        {
          url: '{baseUrl}/images/web.webp',
          size: 32
        }
      ]
    }
  },
  'idp-b-test.de': {
    ...baseConfig,
    branding: {
      background_color: 'rgb(173, 216, 230)',
      color: '0xffffff',
      icons: [
        {
          url: '{baseUrl}/images/gmx.webp',
          size: 32
        }
      ]
    }
  },
  localhost: {
    ...baseConfig,
    branding: {
      background_color: 'rgb(255, 255, 204)',
      color: '0xffffff',
      icons: [
        {
          url: '{baseUrl}/images/web.webp',
          size: 32
        }
      ]
    }
  },
  'dry-lake-09460.herokuapp.com': {
    ...baseConfig,
    branding: {
      background_color: 'rgb(255, 255, 204)',
      color: '0xffffff',
      icons: [
        {
          url: '{baseUrl}/images/web.webp',
          size: 32
        }
      ]
    }
  }
}

// RP Metadata

const clientMetaData = {
  asdfasdfw23e4234qw: {
    name: 'Sample Client Cauliflower',
    origin: 'https://furtive-candy-cauliflower.glitch.me'
  },
  '234q2asdfasdfasdfa': {
    name: 'Sample Client Cauliflower',
    origin: 'https://furtive-candy-cauliflower.glitch.me'
  }
  // Add more clients here
}

// Use middleware to set the correct user map based on the hostname and the client metadata
app.use((req, res, next) => {
  const hostname = req.hostname
  console.log('hostname', hostname)
  const baseUrl = `${req.protocol}://${req.hostname}:${req.socket.localPort}`
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
