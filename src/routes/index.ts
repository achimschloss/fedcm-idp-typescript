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

export default router;
