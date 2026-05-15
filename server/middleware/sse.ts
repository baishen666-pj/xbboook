import { Request, Response } from 'express';

export function setupSSE(req: Request, res: Response): void {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders();

  req.on('close', () => {
    res.end();
  });
}

export function sendSSE(res: Response, event: string, data: unknown): void {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

export function sendSSEError(res: Response, error: string): void {
  sendSSE(res, 'error', { error });
  res.end();
}

export function sendSSEDone(res: Response, fullContent: string): void {
  sendSSE(res, 'done', { content: fullContent });
  res.end();
}
