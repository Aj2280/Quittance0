// Body size enforcement middleware. Express's built-in limit option is set
// framework-wide, but this middleware adds explicit validation and returns a
// structured error response consistent with the rest of the API.
//
// 16 KB is generous for invoice create (a few hundred bytes) and verify (a
// 64-char hash + payer info), but tight enough to prevent memory pressure from
// a script sending megabyte-sized payloads.
import { Request, Response, NextFunction } from 'express';

const MAX_BODY_SIZE_BYTES = 16 * 1024; // 16 KB

export function bodyLimitMiddleware(req: Request, res: Response, next: NextFunction): void {
  let size = 0;

  // Track size as chunks arrive
  req.on('data', (chunk: Buffer) => {
    size += chunk.length;
    
    if (size > MAX_BODY_SIZE_BYTES) {
      // Stop reading and send 413
      req.pause();
      req.removeAllListeners('data');
      req.removeAllListeners('end');
      
      res.status(413).json({
        success: false,
        error: `Request body exceeds maximum size of ${MAX_BODY_SIZE_BYTES} bytes`,
        code: 'PAYLOAD_TOO_LARGE',
        maxSizeBytes: MAX_BODY_SIZE_BYTES,
      });
      
      // Drain the request to prevent connection hang
      req.resume();
      req.on('data', () => {});
    }
  });

  next();
}

export default bodyLimitMiddleware;
