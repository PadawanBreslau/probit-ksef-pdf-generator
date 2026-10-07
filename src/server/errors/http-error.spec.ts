// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { badRequest, HttpError, notFound, payloadTooLarge, unsupportedMediaType } from './http-error';

describe('HttpError', () => {
  it('keeps the status, code and message', () => {
    const error = new HttpError(418, 'TEAPOT', 'I am a teapot');

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('HttpError');
    expect(error.status).toBe(418);
    expect(error.code).toBe('TEAPOT');
    expect(error.message).toBe('I am a teapot');
  });
});

describe('error factories', () => {
  it('creates a bad request error with the default code', () => {
    expect(badRequest('nope')).toMatchObject({ status: 400, code: 'BAD_REQUEST', message: 'nope' });
  });

  it('creates a bad request error with a custom code', () => {
    expect(badRequest('nope', 'INVALID_XML')).toMatchObject({ status: 400, code: 'INVALID_XML' });
  });

  it('creates the remaining error types', () => {
    expect(unsupportedMediaType('x')).toMatchObject({ status: 415, code: 'UNSUPPORTED_MEDIA_TYPE' });
    expect(payloadTooLarge('x')).toMatchObject({ status: 413, code: 'PAYLOAD_TOO_LARGE' });
    expect(notFound('x')).toMatchObject({ status: 404, code: 'NOT_FOUND' });
  });
});
