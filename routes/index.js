var express = require('express')
var router = express.Router()

// Root route
router.get('/', (req, res) => {
  console.log('index - req.session.user:', req.session.user)
  if (req.session && req.session.user) {
    res.render('signed_in', {
      user: req.session.user,
      clientMetaData: req.clientMetaData,
      IDPMetadata: req.IDPMetadata,
      hostname: req.hostname
    })
  } else {
    res.render('index', { req: req, IDPMetadata: req.IDPMetadata })
  }
})

router.get('/.well-known/web-identity', (req, res) => {
  const hostname = req.hostname
  if (req.supportedIDPOrigins.includes(hostname)) {
    res.json({ provider_urls: [`https://${req.hostname}/fedcm.json`] })
  } else {
    res.send('hello from other domains')
  }
})

router.get('/fedcm.json', (req, res) => {
  if (req.IDPMetadata) {
    res.json(req.IDPMetadata)
  } else {
    res.status(404).send('Configuration not found - please check app.js')
  }
})

module.exports = router
