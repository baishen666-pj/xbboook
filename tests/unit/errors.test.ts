import { describe, it, expect } from 'vitest';
import { AppError, NotFoundError, ValidationError, AuthError, ForbiddenError } from '../../server/middleware/errors.js';

describe('AppError', () => {
  it('creates with default status 500', () => {
    const err = new AppError('test');
    expect(err.statusCode).toBe(500);
    expect(err.message).toBe('test');
    expect(err.name).toBe('AppError');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(AppError);
  });

  it('creates with custom status code', () => {
    const err = new AppError('conflict', 409);
    expect(err.statusCode).toBe(409);
  });
});

describe('NotFoundError', () => {
  it('creates with status 404', () => {
    const err = new NotFoundError('项目');
    expect(err.statusCode).toBe(404);
    expect(err.message).toBe('项目不存在');
    expect(err.name).toBe('NotFoundError');
    expect(err).toBeInstanceOf(AppError);
  });

  it('creates with id', () => {
    const err = new NotFoundError('章节', 'ch-123');
    expect(err.message).toBe('章节 ch-123 not found');
  });

  it('creates with default message', () => {
    const err = new NotFoundError();
    expect(err.message).toBe('资源不存在');
  });
});

describe('ValidationError', () => {
  it('creates with status 400', () => {
    const err = new ValidationError('标题不能为空');
    expect(err.statusCode).toBe(400);
    expect(err.message).toBe('标题不能为空');
    expect(err.name).toBe('ValidationError');
  });

  it('creates with default message', () => {
    const err = new ValidationError();
    expect(err.message).toBe('参数验证失败');
  });
});

describe('AuthError', () => {
  it('creates with status 401', () => {
    const err = new AuthError('token expired');
    expect(err.statusCode).toBe(401);
    expect(err.message).toBe('token expired');
    expect(err.name).toBe('AuthError');
  });

  it('creates with default message', () => {
    const err = new AuthError();
    expect(err.message).toBe('未授权');
  });
});

describe('ForbiddenError', () => {
  it('creates with status 403', () => {
    const err = new ForbiddenError('not admin');
    expect(err.statusCode).toBe(403);
    expect(err.message).toBe('not admin');
    expect(err.name).toBe('ForbiddenError');
  });

  it('creates with default message', () => {
    const err = new ForbiddenError();
    expect(err.message).toBe('权限不足');
  });
});