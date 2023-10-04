import jwt from 'jsonwebtoken';
import { Router, Request, Response, NextFunction } from 'express';
import { checkSecFetchDest } from '../services/util';
import crypto from 'crypto';
import { token } from 'morgan';

export const fedcmRouter = Router();

const SECRET_KEY = 'xxxxxxx'


/**
 * Client metadata endpoint.
 * @see https://fedidcg.github.io/FedCM/#idp-api-client-id-metadata-endpoint
 * @route GET /client_metadata_endpoint
 */
fedcmRouter.get('/client_metadata_endpoint', checkSecFetchDest, (req: Request, res: Response) => {
  const hostname = req.hostname

  // Check if the hostname is in the list of supportedIDPOrigins
  if (req.supportedIDPOrigins.includes(hostname)) {
    return res.json({
      privacy_policy_url: `https://${hostname}/privacy_policy.html`,
      terms_of_service_url: `https://${hostname}/terms_of_service.html`
    })
  } else {
    // Handle the case when the hostname is not in the supportedIDPOrigins list
    return res.status(400).send('Unsupported hostname')
  }
})

/**
 * Accounts endpoint. 
 * @see https://fedidcg.github.io/FedCM/#idp-api-accounts-endpoint
 * @route GET /accounts_endpoint
 */
fedcmRouter.get('/accounts_endpoint', checkSecFetchDest, (req: Request, res: Response) => {

  if (!req.session.loggedInUser) {
    return res.json({
      accounts: []
    }) // Return an empty result if no user is logged in
  }

  const currentUser = req.session.loggedInUser

  return res.json({
    accounts: [
      {
        id: currentUser.accountId,
        name: currentUser.name,
        given_name: currentUser.name,
        email: currentUser.email,
        picture: currentUser.avatarUrl,
        approved_clients: currentUser.approved_clients
      }
    ]
  })
})

/**
 * Token endpoint.
 * @see https://fedidcg.github.io/FedCM/#idp-api-id-assertion-endpoint
 * @route POST /token_endpoint
 */
fedcmRouter.post('/token_endpoint', checkSecFetchDest, async (req: Request, res: Response, next: NextFunction) => {
  if (!req.session.loggedInUser) {
    return res.json({}) // Return an empty result if no user is logged in
  }
  const {
    client_id,
    nonce,
    account_id: account_id_request,
    disclosure_text_shown,
    scope
  } = req.body

  const {
    email,
    name,
    avatarUrl,
    accountId: account_id_session
  } = req.session.loggedInUser

  // check if req origin matches the req.clientMetaData expected origin for this client_id
  if (!req.clientMetaData[client_id] || req.get('Origin') !== req.clientMetaData[client_id].origin) {
    console.error(`Invalid Origin: ${req.get('Origin')} for client_id: ${client_id}`);
    return res.status(400).json({ error: 'Invalid Origin' });
  }

  // Check if account_id in req.body matches accountId in req.session.user
  // This is to deal with situation where a different user is logged in with the IDP
  if (account_id_request !== account_id_session) {
    console.error(`Invalid account_id: ${account_id_request}`);
    return res.status(400).json({ error: 'Invalid account_id' })
  }

  if (disclosure_text_shown) {
    const userManager = req.userManager

    //fetch user with known accountID to update approved_clients
    const currentUser = await userManager.getUserByAccountID(account_id_session)

    // Add the client from the list of approved clients and update the session
    if (currentUser) {
      await userManager.addApprovedClient(currentUser, client_id)
      req.session.loggedInUser.approved_clients = [...currentUser.approved_clients]
    }
  }

  // Generate a JWT token
  // Default JWT payload
  let jwtPayload: {
    sub: string,
    nonce: string,
    exp: number,
    iat: number,
    email?: string,
    name?: string,
    picture?: string
  } = {
    sub: account_id_session,
    nonce: nonce,
    exp: new Date().getTime() + 1000 * 60 * 60 * 24,
    iat: new Date().getTime(),
  };

  // Support OPENID and generic AuthZ use-cases (scope is optional)
  // If scope is present we add the corresponding properties to the JWT payload
  if (scope) {
    res.json({ "continue_on": `/fedcm/authorize?client_id=${client_id}&scope=${scope}&nonce=${nonce}` });
  }
  // If scope is not present we directly return the JWT token
  // This means that the client is requesting all standard properties in the current FedCM design
  else {
    // Add all properties
    jwtPayload.email = email;
    jwtPayload.name = name;
    jwtPayload.picture = avatarUrl;
    const token = jwt.sign(jwtPayload, SECRET_KEY);
    res.json({ token: token })
  }
  //console.log(jwt.decode(token))
})

// Define the route to serve the /fedcm/authorize endpoint
fedcmRouter.get('/authorize', (req, res) => {
  const scope = req.query.scope as string;
  const nonce = req.query.nonce as string;
  const client_id = req.query.client_id as string;

  // For later use - display account for approval
  const {
    email,
    name,
    avatarUrl,
    accountId: account_id_session
  } = req.session.loggedInUser

  res.render('auth_view.ejs',
    {
      scope: scope,
      hostname: req.hostname,
      user: req.session.loggedInUser,
      IDPMetadata: req.IDPMetadata,
      nonce: nonce,
      client: req.clientMetaData[client_id],
      client_id: client_id
    });
});

// Endpoint to handle successful authorization
fedcmRouter.post('/authorize_endpoint', (req, res) => {
  const {
    client_id,
    scope,
    nonce
  } = req.body

  const {
    email,
    name,
    avatarUrl,
    accountId: account_id_session
  } = req.session.loggedInUser

  const nonStandardScopes = scope.replace(/openid|email|name|profile|picture/g, '').trim()

  if (!scope || !nonce || !client_id) {
    return res.status(400).send('Missing required query parameters');
  }

  // Generate a JWT token confirming to the authorization
  let tokenPayload: {
    access_token?: string,
    token_type: string,
    expires_in: number,
    id_token?: string,
  } = {
    token_type: 'Bearer',
    expires_in: new Date().getTime() + 1000 * 60 * 60 * 24,
  };

  if (nonStandardScopes) {
    let access_token = {
      iss: req.hostname,
      iat: new Date().getTime(),
      exp: new Date().getTime() + 1000 * 60 * 60 * 24,
      // anything but openid, profile, email, name, picture
      scope: nonStandardScopes,
      jti: crypto.randomBytes(16).toString('hex'),
      client_id: client_id,
      nonce: nonce,
    }
    tokenPayload.access_token = jwt.sign(access_token, SECRET_KEY);
  }
  if (scope.includes('openid')) {
    let idtoken: {
      sub: string,
      nonce: string,
      exp: number,
      iat: number,
      email?: string,
      name?: string,
      picture?: string
    } = {
      sub: account_id_session,
      nonce: nonce,
      exp: new Date().getTime() + 1000 * 60 * 60 * 24,
      iat: new Date().getTime(),
    };

    if (scope.includes('email')) {
      idtoken.email = email;
    }
    if (scope.includes('name')) {
      idtoken.name = name;
    }
    if (scope.includes('picture')) {
      idtoken.picture = avatarUrl;
    }
    tokenPayload.id_token = jwt.sign(idtoken, SECRET_KEY);
  }

  const token = jwt.sign(tokenPayload, SECRET_KEY);
  res.send(token)
});

/**
 * Embedded view route for personalized button. 
 * Servers an embedded view for the personalized button to be used by the RP
 * Server side code is mainly used to validate the origin of the request (top level origin))
 * @see https://github.com/fedidcg/FedCM/issues/382
 * @route GET /embedded
 */
fedcmRouter.get('/embedded', (req, res) => {

  const hostname = req.hostname

  // Derive the base URL from the host (hostname incl. port) and scheme
  // Note this is only needed to support multiple IDPs in parallel
  const host = req.get('host');
  const origin = `${req.protocol}://${host}`;

  const client_id = req.query.clientId as string;
  const iFrame_referer = req.get('Referer')?.replace(/\/$/, '') as string;

  // check if the IFrames referer matches the req.clientMetaData expected origin for this client_id
  if (iFrame_referer !== req.clientMetaData[client_id].origin) {
    return res.status(400).json({ error: 'Invalid Origin' })
  }

  if (req.supportedIDPOrigins.includes(hostname)) {

    const configURL = `${origin}/fedcm.json`;
    const user_info = {}
    const idp_logo = req.IDPMetadata.branding.icons[0].url;


    res.render('embedded_view.ejs',
      {
        configURL,
        client_id,
        user_info,
        idp_logo: idp_logo
      });

  } else {
    res.status(404).send('Configuration not found - please check app.js');
  }
});
