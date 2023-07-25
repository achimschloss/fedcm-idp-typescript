// Import statements
import createError, { HttpError } from 'http-errors';
import express, { Request, Response, NextFunction } from 'express';
import session from 'express-session';
import path from 'path';
import logger from 'morgan';

import { UserManager } from './services/userManager';

// Add routes for the index and sign-in pages
import { indexRouter } from './routes/index';

// Add route for metadata endpoints
import { metaDataRouter } from './routes/metadata';

// Add routes for the FedCM endpoints
import { fedcmRouter } from './routes/fedcm';

// Add routes for the auth endpoints (sign-in, sign-up, remove client)
import { authRouter } from './routes/auth_router';

// IDP Metadata
import { IDPMetadata, IDPMetadataConfig } from './config/idp_metadata.interface';

const app = express()

// IDP Metadata
const SupportedIDPMetadata: IDPMetadataConfig = require('./config/idp_metadata.json');
// RP Metadata
const clientMetaDataConfig = require('./config/client_metadata.json');

declare global {
  namespace Express {
    interface Request {
      userManager: UserManager;
      clientMetaData: any;
      supportedIDPOrigins: string[];
      IDPMetadata: IDPMetadata;
    }
  }
}

// Set up middleware
app.use(express.urlencoded({ extended: false }))

app.use(
  session({
    secret: 'mysecret', // replace with your own secret
    resave: false,
    saveUninitialized: false,
    cookie: {
      // Set to secure in case we are neither running on localhost nor on Heroku
      secure: process.env.LOCALHOST ? false : (process.env.HEROKU_APP_NAME ? false : true)
    }
  })
)

// Define a constant for the supported hostnames
const supportedIDPOrigins = Object.keys(SupportedIDPMetadata)

// Create a in-memory User Manager (keyed by hostname) initialized per hostname automatically
const userManager = new UserManager(supportedIDPOrigins)

// Use middleware to set the correct user map based on the hostname and the client metadata
app.use((req: Request, res: Response, next: NextFunction) => {
  const hostname = req.hostname
  console.log('hostname', hostname)

  // Derive the base URL from the hostname and port (if localhost)
  const isLocalhost =
    req.hostname === 'localhost' || req.hostname === '127.0.0.1'
  const port = isLocalhost ? `:${req.socket.localPort}` : ''
  const baseUrl = `${req.protocol}://${req.hostname}${port}`

  const metadata = (SupportedIDPMetadata as IDPMetadataConfig)[hostname];

  // Add userManager to the req object
  req.userManager = userManager

  // Add clientMetaData to the req object for routers to use
  req.clientMetaData = clientMetaDataConfig

  // Add supportedIDPOrigins to the req object
  req.supportedIDPOrigins = supportedIDPOrigins

  // Add IDPMetadata to the req object for routers to use
  // replace {baseUrl} with the actual base URL to use (based on hostname)
  req.IDPMetadata = JSON.parse(
    JSON.stringify(metadata).replace('{baseUrl}', baseUrl)
  );
  //console.log('req.IDPMetadata', req.IDPMetadata)
  next()
})

// View engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs')

app.use(logger('dev'))
app.use(express.json())
app.use(express.static(path.join(__dirname, 'public')))

// Set up routes
app.use('/', indexRouter)
app.use('/', metaDataRouter)
app.use('/api/auth/', authRouter)
app.use('/fedcm/', fedcmRouter)

// Catch 404 and forward to error handler
app.use((req, res, next) => {
  next(createError(404))
})

// Error handler
app.use((err: HttpError, req: Request, res: Response, next: NextFunction) => {
  // Set locals, only providing error in development
  res.locals.message = err.message
  res.locals.error = req.app.get('env') === 'development' ? err : {}

  // Render the error page
  res.status(err.status || 404)
  res.render('error', { title: 'Error', error: err })
})

export { app };
