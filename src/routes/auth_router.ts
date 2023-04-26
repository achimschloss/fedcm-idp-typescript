import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { Router, Request, Response } from 'express';
import { User, removeApprovedClient } from '../services/user';


const router = Router();

/**
 * User sign-up endpoint.
 * @route POST /signup
 */
router.post('/signup', (req: Request, res: Response) => {

  const { email, name, secret } = req.body

  if (!req.userManager) {
    return res.status(400).send('User manager is not available, check app.js')
  }

  if (!email || !name || !secret) {
    return res.status(400).send('Email, name, and secret are required')
  }

  if (req.userManager.getUser(email, req.hostname)) {
    return res.status(409).send('An account with this email already exists')
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
  const newUser: User = {email, secret, name, accountId, avatarUrl,approved_clients: []}
  req.userManager.addUser(newUser, req.hostname)

  // Store user information in the session
  req.session.user = newUser

  //console.log('signup - req.session.user:', req.session.user)
  // Redirect to the root URL after successful account creation and sign-in
  res.redirect('/')
})

/**
 * User sign-in endpoint.
 * @route POST /signin
 */
router.post('/signin', (req: Request, res: Response) => {
  const { email, secret } = req.body

  if (!email || !secret) {
    return res.status(400).send('Email and password are required')
  }

  const user = req.userManager.getUser(email, req.hostname)

  if (!user || user.secret !== secret) {
    return res.status(401).send('Invalid email or password')
  }

  // Store user information and secret in the session
  req.session.user = user

  //console.log('signin - req.session.user:', req.session.user)
  // Redirect to the root URL after successful sign-in
  res.redirect('/')
})

/**
 * Endpoint for removing a client from the user's list of approved clients.
 * @route POST /remove_client
 */
router.post('/remove_client', (req: Request, res: Response) => {
  const { client_id } = req.body
  if (!req.userManager) {
    return res.redirect('/')
  }

  const { email } = req.session.user
  const currentUser = req.userManager.getUser(email, req.hostname)

  // Remove the client from the list of approved clients and update the session
  if (currentUser) {
    removeApprovedClient(currentUser, client_id)
    req.session.user.approved_clients = [...currentUser.approved_clients]
  }

  res.redirect('/')
})

/**
 * User sign-out endpoint.
 * @route POST /signout
 */
router.post('/signout', (req: Request, res: Response) => {
  if (req.session) {
    req.session.destroy(err => {
      if (err) {
        return res.status(500).send('Error signing out')
      }
      res.redirect('/')
    })
  } else {
    res.redirect('/')
  }
})

export default router;
