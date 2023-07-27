import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { Router, Request, Response } from 'express';
import { User, addAuthenticatorDevice, removeApprovedClient } from '../services/user';
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
 * Registration (a.k.a. "Registration")
 */
authRouter.post('/generate-registration-options', (req, res) => {

  const { email, name } = req.body
  const rpID = req.hostname
  const rpName = "TestIDP - " + req.hostname

  if (!req.userManager) {
    return res.status(400).send({ error: 'User manager is not available, check app.js' })
  }

  if (!email || !name) {
    return res.status(400).send({ error: 'Email, name' })
  }
  // As of now we only support a single authenticator per user
  if (req.userManager.getUser(email, req.hostname)) {
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
  const newUser: User = { email, name, accountId, avatarUrl, approved_clients: [] }

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

// Verify Registration

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

    addAuthenticatorDevice(newUser, newDevice);
    // finale store user in userManager
    if (!req.userManager) {
      return res.status(400).send({ error: 'User manager is not available, check app.js' })
    }
    // Save the new user
    req.userManager.addUser(newUser, req.hostname)

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
 * Login (a.k.a. "Authentication")
 */
authRouter.post('/generate-authentication-options', (req, res) => {
  const { email } = req.body
  const rpID = req.hostname

  const user = req.userManager.getUser(email, req.hostname)

  const opts: GenerateAuthenticationOptionsOpts = {
    timeout: 60000,
    userVerification: 'required',
    rpID,
  };

  // In case user is known, add the authenticator devices to the options
  if (user) {
    opts.allowCredentials = user.authDevice.map(dev => ({
      id: dev.credentialID,
      type: 'public-key',
      transports: dev.transports,
    }));
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

authRouter.post('/verify-authentication', async (req, res) => {

  const body: AuthenticationResponseJSON = req.body;
  const rpID = req.hostname
  const expectedOrigin = `${req.protocol}://${req.hostname}`
  const hostname = req.hostname;

  // Get the user object from the user manager
  let user = req.userManager.getUser(req.session.passkeyLogin, hostname)
  const expectedChallenge = req.session.currentChallenge;

  // This should not happen, but cancel in case of an unexpected condition
  // User might be null if the user is not known to the IDP just now
  if (!expectedChallenge) {
    //cleanup
    req.session.currentChallenge = undefined;
    req.session.passkeyLogin = undefined;

    return res.status(400).send({ error: 'User or challenge is missing' });
  }

  let existingDevice: AuthenticatorDevice | undefined;
  const bodyCredIDUint8Array = new Uint8Array(base64url.toBuffer(body.rawId));
  if (user) {
    // Search for the authenticator device within the user's devices
    for (const dev of user.authDevice) {
      const devCredentialID: Uint8Array = new Uint8Array(dev.credentialID);
      if (isoUint8Array.areEqual(bodyCredIDUint8Array, devCredentialID)) {
        existingDevice = dev;
        break;
      }
    }
  } else {
    // Search for the authenticator device within all users
    user = req.userManager.getUserByCredentialIDAndHostname(bodyCredIDUint8Array, hostname);
    if (user) {
      for (const dev of user.authDevice) {
        const devCredentialID: Uint8Array = new Uint8Array(dev.credentialID);
        if (isoUint8Array.areEqual(bodyCredIDUint8Array, devCredentialID)) {
          existingDevice = dev;
          break;
        }
      }
    }
  }

  if (!existingDevice) {
    return res.status(400).send({ error: 'Unkown Authenticator' });
  }

  let verification: VerifiedAuthenticationResponse;
  try {
    const opts: VerifyAuthenticationResponseOpts = {
      response: body,
      expectedChallenge: `${expectedChallenge}`,
      expectedOrigin,
      expectedRPID: rpID,
      authenticator: existingDevice,
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
    existingDevice.counter = authenticationInfo.newCounter;
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
authRouter.post('/signup', (req: Request, res: Response) => {

  const { email, name, secret } = req.body

  if (!req.userManager) {
    return res.status(400).send({ error: 'User manager is not available, check app.js' })
  }

  if (!email || !name || !secret) {
    return res.status(400).send({ error: 'Email, name, and secret are required' })
  }

  if (req.userManager.getUser(email, req.hostname)) {
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
  const newUser: User = { email, secret, name, accountId, avatarUrl, approved_clients: [] }
  req.userManager.addUser(newUser, req.hostname)

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
authRouter.post('/signin', (req: Request, res: Response) => {
  const { email, secret } = req.body

  if (!email || !secret) {
    return res.status(400).send({ error: 'Email and password are required' })
  }

  const user = req.userManager.getUser(email, req.hostname)

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
authRouter.post('/remove_client', (req: Request, res: Response) => {
  const { client_id } = req.body
  if (!req.userManager) {
    return res.redirect('/')
  }

  const { email } = req.session.loggedInUser
  const currentUser = req.userManager.getUser(email, req.hostname)

  // Remove the client from the list of approved clients and update the session
  if (currentUser) {
    removeApprovedClient(currentUser, client_id)
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
