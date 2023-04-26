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
  //console.log('cookie:' + req.get('cookie'))
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
    disclosure_text_shown
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
  if (req.get('Origin') !== req.clientMetaData[client_id].origin) {
    return res.status(400).json({ error: 'Invalid Origin' })
  }

  // Check if account_id in req.body matches accountId in req.session.user
  // This is to deal with situation where a different user is logged in with the IDP
  if (account_id_request !== account_id_session) {
    return res.status(400).json({ error: 'Invalid account_id' })
  }

  if (disclosure_text_shown) {
    const userManager = req.userManager
    const currentUser = userManager.getUser(email, req.hostname)

    // Add the client from the list of approved clients and update the session
    if (currentUser) {
      addApprovedClient(currentUser,client_id)
      req.session.user.approved_clients = [...currentUser.approved_clients]
    }
  }

  // Generate a JWT token
  const token = jwt.sign(
    {
      sub: account_id_session,
      nonce: nonce,
      name: name,
      email: email,
      exp: new Date().getTime() + 1000 * 60 * 60 * 24,
      iat: new Date().getTime(),
      picture: avatarUrl
    },
    SECRET_KEY
  )

  res.json({ token: token })
 //console.log(jwt.decode(token))
})

/**
 * Revocation endpoint.
 * @route POST /revocation_endpoint
 */
router.post('/revocation_endpoint', (req: Request, res: Response) => {
  console.log('Referer:' + req.get('Referer'))
  console.log('cookie:' + req.get('cookie'))
  console.log('sec-fedcm-csrf:' + req.get('sec-fedcm-csrf'))
  console.log('Body:' + JSON.stringify(req.body))
  res.status(204).send()
})

export default router;
