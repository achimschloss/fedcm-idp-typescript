import express, { Request, Response, NextFunction } from 'express';

// Define constant for header value
const WEBIDENTITY_HEADER = 'webidentity';

// Define middleware function to check Sec-Fetch-Dest header
export function checkSecFetchDest(req: Request, res: Response, next: NextFunction) {
    const secFetchDest = req.get('Sec-Fetch-Dest');

    if (secFetchDest !== WEBIDENTITY_HEADER) {
        return res.status(400).json({ error: 'Invalid Sec-Fetch-Dest header' });
    }
    next();
}