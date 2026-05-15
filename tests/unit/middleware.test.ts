import { describe, it, expect, vi } from 'vitest';
import { validate } from '../../server/middleware/validate.js';
import { errorHandler } from '../../server/middleware/errorHandler.js';
import { z } from 'zod';
import type { Request, Response, NextFunction } from 'express';

function mockRes(): { json: ReturnType<typeof vi.fn>; status: ReturnType<typeof vi.fn> } {
  const json = vi.fn();
  const status = vi.fn(() => ({ json }));
  return { json, status };
}

describe('validate middleware', () => {
  const schema = z.object({
    name: z.string().min(1),
    age: z.number().int().min(0),
  });

  it('passes valid body through', () => {
    const req = { body: { name: 'Test', age: 25 } } as Request;
    const res = mockRes() as unknown as Response;
    const next = vi.fn();
    validate(schema)(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.body).toEqual({ name: 'Test', age: 25 });
  });

  it('returns 400 for invalid body', () => {
    const req = { body: { name: '', age: -1 } } as Request;
    const res = mockRes() as unknown as Response;
    const next = vi.fn();
    validate(schema)(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 400 for missing fields', () => {
    const req = { body: {} } as Request;
    const res = mockRes() as unknown as Response;
    const next = vi.fn();
    validate(schema)(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
  });
});

describe('errorHandler', () => {
  it('returns 500 with error structure', () => {
    const req = {} as Request;
    const json = vi.fn();
    const status = vi.fn(() => ({ json }));
    const res = { status } as unknown as Response;
    errorHandler(new Error('test error'), req, res, vi.fn() as NextFunction);
    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false }),
    );
  });

  it('handles missing error message', () => {
    const req = {} as Request;
    const json = vi.fn();
    const status = vi.fn(() => ({ json }));
    const res = { status } as unknown as Response;
    errorHandler(new Error(), req, res, vi.fn() as NextFunction);
    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false }),
    );
  });
});
