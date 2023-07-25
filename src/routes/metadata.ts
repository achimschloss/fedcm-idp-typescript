import { Router, Request, Response } from 'express';

const metaDataRouter = Router();

/**
 * Web identity metadata route.
 * Provides web identity metadata for supported IDP origins.
 * @see https://fedidcg.github.io/FedCM/#idp-api-well-known
 * @route GET /.well-known/web-identity
 */
metaDataRouter.get('/.well-known/web-identity', (req: Request, res: Response) => {
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
metaDataRouter.get('/fedcm.json', (req: Request, res: Response) => {
    if (req.IDPMetadata) {
        res.json(req.IDPMetadata);
    } else {
        res.status(404).send('Configuration not found - please check app.js');
    }
});

export default metaDataRouter;