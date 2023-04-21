const express = require('express')
const router = express.Router()
const bcrypt = require('bcrypt')

const { v4: uuidv4 } = require('uuid')

/*// Temporary in-memory user storage
const users = new Map()*/

// User sign-up
router.post('/signup', (req, res) => {
  console.log('signup req:', req.body)
  console.log('signup req:', req.users)
  const { email, name, secret } = req.body

  //add check if req.users is undefined
  if (!req.users) {
    return res.status(400).send('req.users is undefined, check app.js')
  }

  if (!email || !name || !secret) {
    return res.status(400).send('Email, name, and secret are required')
  }

  if (req.users.has(email)) {
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
  req.users.set(email, { email, secret, name, accountId, avatarUrl })

  // Store user information and secret in the session
  req.session.user = { email, name, accountId, avatarUrl }

  console.log('signup - req.session.user:', req.session.user)
  // Redirect to the root URL after successful account creation and sign-in
  res.redirect('/')
})

// User sign-in
router.post('/signin', (req, res) => {
  const { email, secret } = req.body

  if (!email || !secret) {
    return res.status(400).send('Email and password are required')
  }

  const user = req.users.get(email)

  if (!user || user.secret !== secret) {
    return res.status(401).send('Invalid email or password')
  }

  // Store user information and secret in the session
  req.session.user = { ...user }
  console.log('signin - req.session.user:', req.session.user)
  // Redirect to the root URL after successful sign-in
  res.redirect('/')
})

router.post('/remove_client', (req, res) => {
  const { client_id } = req.body
  if (!req.session.user || !req.users) {
    return res.redirect('/')
  }

  const { email, approved_clients } = req.session.user
  const user = req.users.get(email)

  if (user && approved_clients && user.approved_clients) {
    // Remove the client_id from both req.user and req.session.user approved_clients
    user.approved_clients = user.approved_clients.filter(id => id !== client_id)
    req.session.user.approved_clients =
      req.session.user.approved_clients.filter(id => id !== client_id)
  }

  res.redirect('/')
})

// User sign-out
router.post('/signout', (req, res) => {
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

module.exports = router
