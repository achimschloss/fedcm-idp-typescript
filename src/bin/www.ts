#!/usr/bin/env node

/**
 * Module dependencies.
 */

import {app} from '../app';
import debug from 'debug';
const log = debug('fedcm:server');
import * as https from 'https';
import * as tls from 'tls';
import * as fs from 'fs';
import * as http from 'http';


// Check if the HEROKU_APP_NAME environment variable is set
var isHeroku = !!process.env.HEROKU_APP_NAME

/**
 * Get port from environment and store in Express.
 */

var port = normalizePort(process.env.PORT || '443')
app.set('port', port)

/**
 * Create server based on the environment (Heroku or not).
 */

var server: http.Server | https.Server

if (isHeroku) {
  // For Heroku, create an HTTP server
  server = http.createServer(app);
} else {
  // For non-Heroku environments, create an HTTPS server with SNI context
  const domain_1 = process.env.DOMAIN_1!;
  const domain_2 = process.env.DOMAIN_2!;

  const credentials_site1 = {
    key: fs.readFileSync(`./certs/${domain_1}/privkey.pem`, 'utf8'),
    cert: fs.readFileSync(`./certs/${domain_1}/fullchain.pem`, 'utf8'),
  };

  const credentials_site2 = {
    key: fs.readFileSync(`./certs/${domain_2}/privkey.pem`, 'utf8'),
    cert: fs.readFileSync(`./certs/${domain_2}/fullchain.pem`, 'utf8'),
  };

  const secureContext = {
    [domain_1]: tls.createSecureContext(credentials_site1),
    [domain_2]: tls.createSecureContext(credentials_site2),
  };

  const sniCallback = (servername: string, done: (err: Error | null, ctx: tls.SecureContext) => void) => {
    if (secureContext[servername]) {
      done(null, secureContext[servername]);
    } else {
      done(new Error(`No matching secure context found for ${servername}`), null as any);
    }
  };

  const serverOptions: https.ServerOptions = {
    SNICallback: sniCallback,
  };

  server = https.createServer(serverOptions, app);
}

/**
 * Listen on provided port, on all network interfaces.
 */

server.listen(port)
server.on('error', onError as (error: { syscall: string; code: any }) => void);
server.on('listening', onListening)

/**
 * Normalize a port into a number, string, or false.
 */

function normalizePort (val: string) {
  var port = parseInt(val, 10)

  if (isNaN(port)) {
    // named pipe
    return val
  }

  if (port >= 0) {
    // port number
    return port
  }

  return false
}

/**
 * Event listener for HTTP server "error" event.
 */

function onError(error: { syscall: string; code: any }): void {
  if (error.syscall !== 'listen') {
    throw error;
  }

  const bind = typeof port === 'string' ? `Pipe ${port}` : `Port ${port}`;

  // handle specific listen errors with friendly messages
  switch (error.code) {
    case 'EACCES':
      console.error(`${bind} requires elevated privileges`);
      process.exit(1);
      break;
    case 'EADDRINUSE':
      console.error(`${bind} is already in use`);
      process.exit(1);
      break;
    default:
      throw error;
  }
}

/**
 * Event listener for HTTP server "listening" event.
 */

function onListening () {
  var addr = server.address()
  var bind = typeof addr === 'string' ? 'pipe ' + addr : 'port ' + addr.port
  debug('Listening on ' + bind)
}
