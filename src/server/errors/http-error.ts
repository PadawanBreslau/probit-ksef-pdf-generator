export class HttpError extends Error {
  public readonly code: string;
  public readonly status: number;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
  }
}

export function badRequest(message: string, code = 'BAD_REQUEST'): HttpError {
  return new HttpError(400, code, message);
}

export function unsupportedMediaType(message: string): HttpError {
  return new HttpError(415, 'UNSUPPORTED_MEDIA_TYPE', message);
}

export function payloadTooLarge(message: string): HttpError {
  return new HttpError(413, 'PAYLOAD_TOO_LARGE', message);
}

export function notFound(message: string): HttpError {
  return new HttpError(404, 'NOT_FOUND', message);
}
