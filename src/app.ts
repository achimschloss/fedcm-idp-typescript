// Import statements
import createError, { HttpError } from 'http-errors';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import session from 'express-session';
import path from 'path';
import logger from 'morgan';

// User Management
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

// Define a constant for the supported hostnames
const supportedIDPOrigins = Object.keys(SupportedIDPMetadata)

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

// define the allowed origins for client requests
const allowedOrigins: string[] = [];

// add configured / known client origins
for (const key in clientMetaDataConfig) {
  if (clientMetaDataConfig.hasOwnProperty(key)) {
    allowedOrigins.push(clientMetaDataConfig[key].origin);
  }
}

// create a function that checks if the origin is allowed
const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  preflightContinue: true
};

console.log('Allowed Origins:', allowedOrigins);

// Set up middleware

app.use(express.urlencoded({ extended: false }))

app.use(
  session({
    name: 'fedcm-idp-session:',
    secret: 'mysecret', // replace with your own secret
    resave: false,
    saveUninitialized: false,
    cookie: {
      // Set to secure in case we are neither running on localhost nor on Heroku
      secure: process.env.LOCALHOST ? false : (process.env.HEROKU_APP_NAME ? false : true)
    }
  })
)

// Enable private network access to allow the RP to access the IDP via the private network
app.use(function (req, res, next) {
  if (req.headers["access-control-request-private-network"]) {
    res.setHeader("access-control-allow-private-network", "true");
  }
  next();
});

// enable CORS for all routes
app.use(cors(corsOptions));

// Create a User Manager (Account managed per hostname)
const userManager = new UserManager()

// Use middleware to inject IDP Metadata, Client Metadata and UserManger into the req object
app.use((req: Request, res: Response, next: NextFunction) => {
  const hostname = req.hostname
  console.log('hostname', hostname)

  // Determine origin based on the host (hostname incl. port) and scheme
  // Note this is only needed to support multiple IDPs in parallel (otherwise could be set from the config file)
  const host = req.get('host');
  const baseUrl = `${req.protocol}://${host}`;

  const metadata = (SupportedIDPMetadata as IDPMetadataConfig)[hostname];

  if (!metadata) {
    console.log('No metadata found for hostname', hostname)
    return res.status(404).send('Unknown hostname')
  }

  allowedOrigins.push(baseUrl);

  // Add userManager to the req object
  req.userManager = userManager

  // Add clientMetaData to the req object for routers to use
  req.clientMetaData = clientMetaDataConfig

  // Add supportedIDPOrigins to the req object
  req.supportedIDPOrigins = supportedIDPOrigins

  // cleanup the login status related parts of the session if it has expired
  // TODO - this should also inform the browser via a corresponding header - We leave this out for now until we add support for manually revoking sessions to test out of band session expiration handling with FedcM
  if (req.session.loggedInUser && req.session.loginSessionExpiration < Date.now()) {
    console.log('Login session expired - IdP-SignIn-Status NOT set to action=signout-all')
    req.session.loginSessionExpiration = undefined
    req.session.loggedInUser = undefined
  }

  // Add IDPMetadata to the req object for routers to use
  // replace {baseUrl} with the actual base URL to use (based on hostname)
  // TODO: this should only be done once
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
