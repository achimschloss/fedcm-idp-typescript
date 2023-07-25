import jwt from 'jsonwebtoken';
import { Router, Request, Response } from 'express';
import { addApprovedClient } from '../services/user';

const router = Router();

const SECRET_KEY = 'xxxxxxx'


/**
 * Client metadata endpoint.
 * @see https://fedidcg.github.io/FedCM/#idp-api-client-id-metadata-endpoint
 * @route GET /client_metadata_endpoint
 */
router.get('/client_metadata_endpoint', (req: Request, res: Response) => {
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
router.get('/accounts_endpoint', (req: Request, res: Response) => {

  // Security checks
  // check if Sec-Fetch-Dest header is present and set to webidentity
  if (req.get('Sec-Fetch-Dest') !== 'webidentity') {
    return res.status(400).json({ error: 'Invalid Sec-Fetch-Dest header' })
  }

  if (!req.session.user) {
    return res.json({
      accounts: []
    }) // Return an empty result if no user is logged in
  }

  const currentUser = req.session.user

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
router.post('/token_endpoint', (req: Request, res: Response) => {
  if (!req.session.user) {
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
  } = req.session.user

  // Security checks
  // check if Sec-Fetch-Dest header is present and set to webidentity
  if (req.get('Sec-Fetch-Dest') !== 'webidentity') {
    return res.status(400).json({ error: 'Invalid Sec-Fetch-Dest header' })
  }
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
    const currentUser = userManager.getUser(email, req.hostname)

    // Add the client from the list of approved clients and update the session
    if (currentUser) {
      addApprovedClient(currentUser, client_id)
      req.session.user.approved_clients = [...currentUser.approved_clients]
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

  // Support default and AuthZ use-case (scope is optional)
  // If scope is present we add the corresponding properties to the JWT payload
  if (scope) {
    // Add properties based on the scope
    if (scope.includes('email')) {
      jwtPayload.email = email;
    }
    if (scope.includes('name')) {
      jwtPayload.name = name;
    }
    if (scope.includes('picture')) {
      jwtPayload.picture = avatarUrl;
    }
  }
  // If scope is not present we add all properties to the JWT payload
  // This means that the client is requesting all properties in the current FedCM design
  else {
    // Add all properties
    jwtPayload.email = email;
    jwtPayload.name = name;
    jwtPayload.picture = avatarUrl;
  }


  const token = jwt.sign(jwtPayload, SECRET_KEY);

  res.json({ token: token })
  //console.log(jwt.decode(token))
})

/**
 * Embedded view route for personalized button. 
 * Servers an embedded view for the personalized button to be used by the RP
 * Server side code is mainly used to validate the origin of the request (top level origin))
 * @see https://github.com/fedidcg/FedCM/issues/382
 * @route GET /embedded
 */
router.get('/embedded', (req, res) => {
  const hostname = req.hostname;
  const client_id = req.query.clientId as string;
  const iFrame_referer = req.get('Referer')?.replace(/\/$/, '') as string;

  // check if the IFrames referer matches the req.clientMetaData expected origin for this client_id
  if (iFrame_referer !== req.clientMetaData[client_id].origin) {
    return res.status(400).json({ error: 'Invalid Origin' })
  }

  if (req.supportedIDPOrigins.includes(hostname)) {

    const configURL = `https://${req.hostname}/fedcm.json`;
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

export default router;
