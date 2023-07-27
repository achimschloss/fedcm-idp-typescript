import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { Router, Request, Response } from 'express';
import { User } from '../services/user';
import { SerializedAuthenticatorDevice } from '../services/userManager';
const base64url = require('base64url');

export const authRouter = Router();

import {
  // Registration
  generateRegistrationOptions,
  verifyRegistrationResponse,
  // Authentication
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import { isoUint8Array } from '@simplewebauthn/server/helpers';
import type {
  GenerateAuthenticationOptionsOpts,
  VerifyRegistrationResponseOpts,
  VerifyAuthenticationResponseOpts,
  VerifiedRegistrationResponse,
  VerifiedAuthenticationResponse,
} from '@simplewebauthn/server';

import type {
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
  AuthenticatorDevice,
} from '@simplewebauthn/typescript-types';

// WebAuthn routes

// Registration Options

/**
 * POST endpoint that generates registration options for WebAuthn registration.
 * 
 * Expects the following fields in the request body:
 * - email: the email address of the user to be registered
 * - name: the name of the user to be registered
 * 
 * Returns a JSON object containing the registration options for WebAuthn registration.
 * 
 * If the user manager is not available, or if the email or name fields are missing from the request body,
 * returns a 400 error with an error message.
 * 
 * If an account with the given email already exists, returns a 409 error with an error message.
 * 
 * If the registration options are generated successfully, stores the new user information in the session
 * (for the duration of the registration flow).
 */
authRouter.post('/generate-registration-options', async (req, res) => {

  const { email, name } = req.body
  const rpID = req.hostname
  const rpName = "TestIDP - " + req.hostname

  if (!req.userManager) {
    return res.status(400).send({ error: 'User manager is not available, check app.js' })
  }

  if (!email || !name) {
    return res.status(400).send({ error: 'Email, name' })
  }

  const existingUser = await req.userManager.getUser(email, req.hostname)
  // As of now we only support a single authenticator per user
  if (existingUser) {
    return res.status(409).send({ error: 'An account with this email already exists' })
  }

  // Generate a random account ID
  const accountId = uuidv4()

  // Hash the email to fetch a gravatar
  const emailHash = bcrypt.hashSync(email, 10)

  // Generate a random avatar URL
  const avatarUrl = `https://avatars.dicebear.com/api/bottts/${encodeURIComponent(
    emailHash
  )}.png`

  // Save the new user
  const newUser: User = {
    _id: accountId,
    email,
    name,
    accountId,
    avatarUrl,
    approved_clients: [],
    hostname: rpID
  }

  // Store user information in the session (for the duration of the registration flow)
  req.session.passkeyRegistration = newUser

  const options = generateRegistrationOptions({
    rpName,
    rpID,
    userID: newUser.accountId,
    userName: newUser.email,
    // Don't prompt users for additional information about the authenticator
    // (Recommended for smoother UX)
    attestationType: 'none',
    // Prevent users from re-registering existing authenticators
    //excludeCredentials: userAuthenticators.map(authenticator => ({
    //  id: authenticator.credentialID,
    //  type: 'public-key',
    //  // Optional
    //  transports: authenticator.transports,
    //})),
    supportedAlgorithmIDs: [-7, -257],
  });

  /**
 * The server needs to temporarily remember this value for verification, so don't lose it until
 * after you verify an authenticator response.
 */
  req.session.currentChallenge = options.challenge;

  res.send(options);
})

/**
 * POST endpoint that verifies a WebAuthn registration response.
 * 
 * Expects the following fields in the request body:
 * - response: the registration response object returned by the authenticator
 * 
 * Returns a JSON object containing a boolean indicating whether the registration was successful.
 * 
 * If the user manager is not available, or if the response field is missing from the request body,
 * returns a 400 error with an error message.
 * 
 * If the registration response is verified successfully, stores the new authenticator device information
 * in the user manager and logs in the user.
 */
authRouter.post('/verify-registration', async (req, res) => {

  const { email, name } = req.body
  const rpID = req.hostname
  const rpName = "TestIDP - " + req.hostname
  const expectedOrigin = `${req.protocol}://${req.hostname}`

  const body: RegistrationResponseJSON = req.body;

  const user = req.session.passkeyRegistration
  const expectedChallenge = req.session.currentChallenge;

  // This should not happen, but cancel in case of an unexpected condition
  if (!user || !expectedChallenge) {
    req.session.currentChallenge = undefined;
    req.session.passkeyRegistration = undefined;
    return res.status(400).send({ error: 'User or challenge is missing' });
  }

  let verification: VerifiedRegistrationResponse;
  try {
    const opts: VerifyRegistrationResponseOpts = {
      response: body,
      expectedChallenge: `${expectedChallenge}`,
      expectedOrigin,
      expectedRPID: rpID,
      requireUserVerification: true,
    };
    verification = await verifyRegistrationResponse(opts);
  } catch (error) {
    const _error = error as Error;
    console.error(_error);
    return res.status(400).send({ error: _error.message });
  }

  const { verified, registrationInfo } = verification;
  const newUser: User = req.session.passkeyRegistration

  if (verified && registrationInfo) {

    const { credentialPublicKey, credentialID, counter } = registrationInfo;

    const newDevice: AuthenticatorDevice = {
      credentialPublicKey,
      credentialID,
      counter,
      transports: body.response.transports,
    };

    if (!req.userManager) {
      return res.status(400).send({ error: 'User manager is not available, check app.js' })
    }

    // Save the new user
    req.userManager.addUser(newUser)

    // Add the authenticator device to the user's list of authenticators
    req.userManager.addAuthenticatorDevice(newUser, newDevice)

    // Store user information in the session
    req.session.loggedInUser = newUser

    // Set FedCM Sign-In status via header
    res.set('IdP-SignIn-Status', 'action=signin');
  }

  //reset passkey states
  req.session.currentChallenge = undefined;
  req.session.passkeyRegistration = undefined;

  // Redirect/Page refresh must be trigger client side here
  res.send({ verified });
})

/**
 * Endpoint for generating authentication options for WebAuthn authentication.
 * POST /generate-authentication-options
 * Expects the following fields in the request body:
 * - email: the email address of the user to be authenticated (optional)
 * 
 * Returns a JSON object containing the authentication options for WebAuthn authentication.
 * 
 * If the user manager is not available, or if the email field is missing from the request body,
 * returns a 400 error with an error message.
 * 
 * If the authentication options are generated successfully, stores the current challenge and user information
 * in the session (for the duration of the authentication flow).
 */

authRouter.post('/generate-authentication-options', async (req, res) => {
  const { email } = req.body
  const rpID = req.hostname

  const opts: GenerateAuthenticationOptionsOpts = {
    timeout: 60000,
    userVerification: 'required',
    // This is always the IDPs hostname
    rpID,
  };

  if (email) {
    const user = await req.userManager.getUser(email, req.hostname)
    if (user) {
      // In case user is known, add the authenticator devices to the options
      const devices = await req.userManager.getAuthenticatorDevicesForAccountID(user.accountId);
      opts.allowCredentials = devices.map((device) => ({
        id: base64url.toBuffer(device.credentialID),
        type: 'public-key',
        transports: device.transports,
      }));
    }
  }

  const options = generateAuthenticationOptions(opts);

  /**
   * The server needs to temporarily remember this value for verification, so don't lose it until
   * after you verify an authenticator response.
   */
  req.session.currentChallenge = options.challenge;

  // Store user information in the session (for the duration of the login flow)
  // In case the verification succeeds, this user will be logged in
  req.session.passkeyLogin = email

  res.send(options);
});


/**
 * Endpoint for verifying the authentication response from the client.
 * @route POST /verify-authentication
 * Expects the following fields in the request body:
 * - rawId: the raw ID of the authenticator device
 * - response: the response object from the authenticator device
 * 
 * Returns a JSON object containing a boolean indicating whether the authentication was verified or not.
 * 
 * If the user manager is not available, or if the expected challenge or authenticator device is missing from the session, returns a 400 error with an error message.
 * 
 */
authRouter.post('/verify-authentication', async (req, res) => {

  const body: AuthenticationResponseJSON = req.body;
  const rpID = req.hostname
  const expectedOrigin = `${req.protocol}://${req.hostname}`
  const hostname = req.hostname;

  // Get the user object from the user manager
  let user = await req.userManager.getUser(req.session.passkeyLogin, hostname)
  const expectedChallenge = req.session.currentChallenge;

  // This should not happen, but cancel in case of an unexpected condition
  // User might be null if the user is not known to the IDP just now
  if (!expectedChallenge) {
    //cleanup
    req.session.currentChallenge = undefined;
    req.session.passkeyLogin = undefined;

    return res.status(400).send({ error: 'User or challenge is missing' });
  }

  let matchingDevice: SerializedAuthenticatorDevice | undefined;
  let existingDevices: SerializedAuthenticatorDevice[] = [];

  // Convert the raw ID to a Uint8Array to compare with existing device's credentialID
  const bodyCredIDUint8Array = new Uint8Array(base64url.toBuffer(body.rawId));

  // In case the user is known, find the matching device
  if (user) {
    existingDevices = await req.userManager.getAuthenticatorDevicesForAccountID(user.accountId)
    for (const device of existingDevices) {
      const Uint8ArrayCredentialID = base64url.toBuffer(device.credentialID)
      if (isoUint8Array.areEqual(Uint8ArrayCredentialID, bodyCredIDUint8Array)) {
        matchingDevice = device;
        break;
      }
    }
    // Conditional UI
    // TODO check if we can provide the username here too to avoid searching the user based on device
  } else {
    // credentialID is the _id of the device, if use is found and device is found, we can use the device
    user = await req.userManager.getUserByCredentialIDAndHostname(bodyCredIDUint8Array, hostname)
    matchingDevice = await req.userManager.getAuthenticatorDevice(bodyCredIDUint8Array)
  }

  if (!matchingDevice) {
    return res.status(400).send({ error: 'Unkown Authenticator' });
  }

  let verification: VerifiedAuthenticationResponse;
  const deserializedMatchingDevice = await req.userManager.deserializeAuthenticatorDevice(matchingDevice);
  try {
    const opts: VerifyAuthenticationResponseOpts = {
      response: body,
      expectedChallenge: `${expectedChallenge}`,
      expectedOrigin,
      expectedRPID: rpID,
      // for now we only allow 1 device per user
      authenticator: deserializedMatchingDevice,
      requireUserVerification: true,
    };
    verification = await verifyAuthenticationResponse(opts);
  } catch (error) {
    const _error = error as Error;
    console.error(_error);
    return res.status(400).send({ error: _error.message });
  }

  const { verified, authenticationInfo } = verification;

  if (verified) {
    // Update the authenticator's counter in the DB to the newest count in the authentication
    matchingDevice.counter = authenticationInfo.newCounter;
    req.userManager.updateAuthDevice(matchingDevice)
  }

  // Store user information in the session
  req.session.loggedInUser = user

  // Set FedCM Sign-In status via header
  res.set('IdP-SignIn-Status', 'action=signin');

  // Cleanup
  req.session.passkeyRegistration = undefined;
  req.session.currentChallenge = undefined;

  res.send({ verified });
})



/**
 * User sign-up endpoint.
 * @route POST /signup
 */
authRouter.post('/signup', async (req: Request, res: Response) => {

  const { email, name, secret } = req.body

  if (!req.userManager) {
    return res.status(400).send({ error: 'User manager is not available, check app.js' })
  }

  if (!email || !name || !secret) {
    return res.status(400).send({ error: 'Email, name, and secret are required' })
  }

  const existingUser = await req.userManager.getUser(email, req.hostname)
  if (existingUser) {
    return res.status(409).send({ error: 'An account with this email already exists' })
  }

  // Generate a random account ID
  const accountId = uuidv4()

  // Hash the email to fetch a gravatar
  const emailHash = bcrypt.hashSync(email, 10)

  // Generate a random avatar URL
  const avatarUrl = `https://avatars.dicebear.com/api/bottts/${encodeURIComponent(
    emailHash
  )}.png`

  // Save the new user
  const newUser: User = {
    _id: accountId,
    email,
    secret,
    name,
    accountId,
    avatarUrl,
    approved_clients: [],
    hostname: req.hostname
  }
  req.userManager.addUser(newUser)

  // Store user information in the session
  req.session.loggedInUser = newUser

  // Set FedCM Sign-In status via header
  res.set('IdP-SignIn-Status', 'action=signin');

  //console.log('signup - req.session.user:', req.session.user)
  // Redirect to the root URL after successful account creation and sign-in
  res.redirect('/')
})



/**
 * User sign-in endpoint.
 * @route POST /signin
 */
authRouter.post('/signin', async (req: Request, res: Response) => {
  const { email, secret } = req.body

  if (!email || !secret) {
    return res.status(400).send({ error: 'Email and password are required' })
  }

  const user = await req.userManager.getUser(email, req.hostname)

  if (!user || user.secret !== secret) {
    return res.status(401).send({ error: 'Invalid email or password' })
  }

  // Store user information and secret in the session
  req.session.loggedInUser = user

  // Set FedCM Sign-In status via header
  res.set('IdP-SignIn-Status', 'action=signin');

  //console.log('signin - req.session.user:', req.session.user)
  // Redirect to the root URL after successful sign-in
  res.redirect('/')
})



/**
 * Endpoint for removing a client from the user's list of approved clients.
 * @route POST /remove_client
 */
authRouter.post('/remove_client', async (req: Request, res: Response) => {
  const { client_id } = req.body
  const userManager = req.userManager

  if (!userManager) {
    return res.redirect('/')
  }

  const { accountId } = req.session.loggedInUser

  //fetch user with known accountID to update approved_clients
  const currentUser = await userManager.getUserByAccountID(accountId)

  // Remove the client from the list of approved clients and update the session
  if (currentUser) {
    await userManager.removeApprovedClient(currentUser, client_id)
    req.session.loggedInUser.approved_clients = [...currentUser.approved_clients]
  }

  res.redirect('/')
})

/**
 * User sign-out endpoint.
 * @route POST /signout
 */
authRouter.post('/signout', (req: Request, res: Response) => {

  // Set FedCM Sign-In status via header
  res.set('IdP-SignIn-Status', 'action=signout-all');

  if (req.session) {
    req.session.destroy(err => {
      if (err) {
        return res.status(500).send({ error: 'Error signing out' })
      }
      res.redirect('/')
    })
  } else {
    res.redirect('/')
  }
})
