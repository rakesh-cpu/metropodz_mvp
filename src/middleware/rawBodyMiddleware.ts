import { Request, Response, NextFunction } from 'express';

interface CustomRequest extends Request {
  rawBody?: string;
}

export const rawBodyMiddleware = (req: CustomRequest, res: Response, next: NextFunction) => {
  if (req.path === '/api/v1/payments/webhook') {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
    });
    req.on('end', () => {
      req.rawBody = data;
      next();
    });
  } else {
    next();
  }
};
