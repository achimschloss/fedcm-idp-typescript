#!/usr/bin/env node

/**
 * Module dependencies.
 */

import { app } from '../app';
import debug from 'debug';
const log = debug('fedcm:server');
import * as https from 'https';
import * as tls from 'tls';
import * as fs from 'fs';
import * as http from 'http';

import { IDPMetadataConfig } from '../config/idp_metadata.interface';

// Check if the HEROKU_APP_NAME environment variable is set
var isHeroku = !!process.env.HEROKU_APP_NAME

// Check if the LOCALHOST environment variable is set
var isLocalhost = !!process.env.LOCALHOST

/**
 * Get port from environment and store in Express.
 */

var port = normalizePort(process.env.PORT || '443')
app.set('port', port)

/**
 * Create server based on the environment (Heroku, localhost or domain).
 */

var server: http.Server | https.Server

if (isHeroku) {
  // For Heroku, create an HTTP server
  server = http.createServer(app);
} else if (isLocalhost) {
  // For localhost, also create an HTTP server
  server = http.createServer(app);
} else {

  const idpMetadataConfig: IDPMetadataConfig = require('../config/idp_metadata.json');

  const secureContext: { [key: string]: tls.SecureContext } = {};

  for (const hostname in idpMetadataConfig) {
    if (hostname !== 'localhost') {
      const credentials = {
        key: fs.readFileSync(`./certs/${hostname}/privkey.pem`, 'utf8'),
        cert: fs.readFileSync(`./certs/${hostname}/fullchain.pem`, 'utf8'),
      };

      secureContext[hostname] = tls.createSecureContext(credentials);
    }
  }

  if (Object.keys(secureContext).length === 0) {
    console.error('No secure contexts were created. Check your certificate paths and hostnames.');
    process.exit(1);
  }

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

function normalizePort(val: string) {
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

function onListening() {
  var addr = server.address()
  var bind = typeof addr === 'string' ? 'pipe ' + addr : 'port ' + addr.port
  debug('Listening on ' + bind)
}
