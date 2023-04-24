import { Router, Request, Response } from 'express';

const router = Router();

// Render the signed_in or index page based on the user session
router.get('/', (req: Request, res: Response) => {
  console.log('index - req.session.user:', req.session.user);
  if (req.session && req.session.user) {
    res.render('signed_in', {
      user: req.session.user,
      clientMetaData: req.clientMetaData,
      IDPMetadata: req.IDPMetadata,
      hostname: req.hostname,
    });
  } else {
    res.render('index', { req: req, IDPMetadata: req.IDPMetadata });
  }
});

// Provide web identity metadata for supported IDP origins
router.get('/.well-known/web-identity', (req: Request, res: Response) => {
  const hostname = req.hostname;
  if (req.supportedIDPOrigins.includes(hostname)) {
    res.json({ provider_urls: [`https://${req.hostname}/fedcm.json`] });
  } else {
    res.send('hello from other domains');
  }
});

// Serve the federation metadata configuration (fedcm.json) for the IDP
router.get('/fedcm.json', (req: Request, res: Response) => {
  if (req.IDPMetadata) {
    res.json(req.IDPMetadata);
  } else {
    res.status(404).send('Configuration not found - please check app.js');
  }
});

export default router;
