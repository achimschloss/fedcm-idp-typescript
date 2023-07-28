import { Router, Request, Response } from 'express';
import { checkSecFetchDest } from '../services/util';

export const metaDataRouter = Router();

/**
 * Web identity metadata route.
 * Provides web identity metadata for supported IDP origins.
 * @see https://fedidcg.github.io/FedCM/#idp-api-well-known
 * @route GET /.well-known/web-identity
 */
metaDataRouter.get('/.well-known/web-identity', checkSecFetchDest, (req: Request, res: Response) => {
    const hostname = req.hostname;
    const isLocalhost =
        req.hostname === 'localhost' || req.hostname === '127.0.0.1'
    const port = isLocalhost ? `:${req.socket.localPort}` : ''
    const baseUrl = `${req.protocol}://${req.hostname}${port}`
    if (req.supportedIDPOrigins.includes(hostname)) {
        res.json({ provider_urls: [`${baseUrl}/fedcm.json`] });
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
metaDataRouter.get('/fedcm.json', checkSecFetchDest, (req: Request, res: Response) => {
    if (req.IDPMetadata) {
        res.json(req.IDPMetadata);
    } else {
        res.status(404).send('Configuration not found - please check app.js');
    }
});