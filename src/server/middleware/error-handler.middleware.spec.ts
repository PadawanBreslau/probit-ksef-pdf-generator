// @vitest-environment node
import { NextFunction, Request, Response } from 'express';
import { MulterError } from 'multer';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpError } from '../errors/http-error';
import { errorHandler, notFoundHandler, toHttpError } from './error-handler.middleware';

function fakeResponse(): Response & { body?: unknown; statusCode: number } {
  const res = {
    headersSent: false,
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) {
      res.statusCode = code;

      return res;
    },
    json(payload: unknown) {
      res.body = payload;

      return res;
    },
  };

  return res as unknown as Response & { body?: unknown; statusCode: number };
}

beforeEach(() => {
  vi.stubEnv('LOG_LEVEL', 'silent');
});

describe('toHttpError', () => {
  it('passes HttpError instances through', () => {
    const error = new HttpError(404, 'NOT_FOUND', 'missing');

    expect(toHttpError(error)).toBe(error);
  });

  it('maps a too large upload', () => {
    expect(toHttpError(new MulterError('LIMIT_FILE_SIZE'))).toMatchObject({
      status: 413,
      code: 'PAYLOAD_TOO_LARGE',
    });
  });

  it('maps an unexpected file field', () => {
    expect(toHttpError(new MulterError('LIMIT_UNEXPECTED_FILE', 'wrong'))).toMatchObject({
      status: 400,
      code: 'UNEXPECTED_FILE_FIELD',
    });
  });

  it('maps any other multer failure', () => {
    expect(toHttpError(new MulterError('LIMIT_PART_COUNT'))).toMatchObject({
      status: 400,
      code: 'INVALID_UPLOAD',
    });
  });

  it('maps body parser errors', () => {
    expect(toHttpError({ status: 413, message: 'request entity too large' })).toMatchObject({
      status: 413,
      code: 'PAYLOAD_TOO_LARGE',
    });
    expect(toHttpError({ statusCode: 400, message: 'broken' })).toMatchObject({
      status: 400,
      code: 'BAD_REQUEST',
      message: 'broken',
    });
  });

  it('maps unknown failures to an internal server error', () => {
    expect(toHttpError(new Error('boom'))).toMatchObject({ status: 500, code: 'INTERNAL_SERVER_ERROR' });
    expect(toHttpError({ status: 500, message: 'leaky internals' })).toMatchObject({
      status: 500,
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Unexpected error while processing the request.',
    });
    expect(toHttpError('nope')).toMatchObject({ status: 500, code: 'INTERNAL_SERVER_ERROR' });
  });
});

describe('errorHandler', () => {
  it('serialises the error as JSON', () => {
    const res = fakeResponse();

    errorHandler(new HttpError(400, 'INVALID_XML', 'broken xml'), {} as Request, res, vi.fn());

    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ error: { code: 'INVALID_XML', message: 'broken xml' } });
  });

  it('delegates to express when the response already started', () => {
    const res = fakeResponse();
    const next = vi.fn() as unknown as NextFunction;
    const error = new Error('too late');

    (res as unknown as { headersSent: boolean }).headersSent = true;
    errorHandler(error, {} as Request, res, next);

    expect(next).toHaveBeenCalledWith(error);
    expect(res.body).toBeUndefined();
  });
});

describe('notFoundHandler', () => {
  it('forwards a 404 error', () => {
    const next = vi.fn();

    notFoundHandler({ method: 'GET', path: '/nope' } as Request, fakeResponse(), next as unknown as NextFunction);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ status: 404, code: 'NOT_FOUND', message: 'Unknown endpoint: GET /nope' })
    );
  });
});
