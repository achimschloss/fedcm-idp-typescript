import { Router, Request, Response } from 'express';

const router = Router();

/**
 * Index route.
 * Renders the 'signed_in' or 'index' page based on the user session.
 * @route GET /
 */
router.get('/', (req: Request, res: Response) => {
  //console.log('index - req.session.user:', req.session.user);
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

/**
 * Web identity metadata route.
 * Provides web identity metadata for supported IDP origins.
 * @see https://fedidcg.github.io/FedCM/#idp-api-well-known
 * @route GET /.well-known/web-identity
 */
router.get('/.well-known/web-identity', (req: Request, res: Response) => {
  const hostname = req.hostname;
  if (req.supportedIDPOrigins.includes(hostname)) {
    res.json({ provider_urls: [`https://${req.hostname}/fedcm.json`] });
  } else {
    res.send('hello from other domains');
  }
});

/**
 * Federation metadata configuration route.
 * Serves the federation metadata configuration (fedcm.json) for the IDP.
 * @see https://fedidcg.github.io/FedCM/#idp-api-manifest
 * @route GET /fedcm.json
 */
router.get('/fedcm.json', (req: Request, res: Response) => {
  if (req.IDPMetadata) {
    res.json(req.IDPMetadata);
  } else {
    res.status(404).send('Configuration not found - please check app.js');
  }
});

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
        { configURL, 
            client_id, 
            user_info, 
            idp_logo: idp_logo
          });

  } else {
    res.status(404).send('Configuration not found - please check app.js');
  }
});

export default router;
