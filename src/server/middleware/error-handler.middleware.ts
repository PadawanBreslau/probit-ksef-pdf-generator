import { ErrorRequestHandler, RequestHandler } from 'express';
import { MulterError } from 'multer';
import { HttpError, notFound } from '../errors/http-error';
import { logger } from '../logger';
import { XML_FIELD_NAME } from './xml-request.middleware';

export interface ErrorResponseBody {
  error: {
    code: string;
    message: string;
  };
}

function fromMulterError(error: MulterError): HttpError {
  switch (error.code) {
    case 'LIMIT_FILE_SIZE':
      return new HttpError(413, 'PAYLOAD_TOO_LARGE', 'The uploaded XML document is too large.');
    case 'LIMIT_UNEXPECTED_FILE':
      return new HttpError(
        400,
        'UNEXPECTED_FILE_FIELD',
        `Unexpected file field. Upload the XML document in the "${XML_FIELD_NAME}" field.`
      );
    default:
      return new HttpError(400, 'INVALID_UPLOAD', `Invalid upload: ${error.message}`);
  }
}

function fromBodyParserError(error: {
  status?: number;
  statusCode?: number;
  message?: string;
}): HttpError | null {
  const status = error.status ?? error.statusCode;

  if (typeof status !== 'number' || status < 400 || status >= 500) {
    return null;
  }

  if (status === 413) {
    return new HttpError(413, 'PAYLOAD_TOO_LARGE', 'The uploaded XML document is too large.');
  }

  return new HttpError(status, 'BAD_REQUEST', error.message ?? 'Invalid request.');
}

export function toHttpError(error: unknown): HttpError {
  if (error instanceof HttpError) {
    return error;
  }

  if (error instanceof MulterError) {
    return fromMulterError(error);
  }

  if (typeof error === 'object' && error !== null) {
    const mapped = fromBodyParserError(error as { status?: number; statusCode?: number; message?: string });

    if (mapped) {
      return mapped;
    }
  }

  return new HttpError(500, 'INTERNAL_SERVER_ERROR', 'Unexpected error while processing the request.');
}

export const notFoundHandler: RequestHandler = (req, _res, next): void => {
  next(notFound(`Unknown endpoint: ${req.method} ${req.path}`));
};

export const errorHandler: ErrorRequestHandler = (error, _req, res, next): void => {
  if (res.headersSent) {
    next(error);

    return;
  }

  const httpError = toHttpError(error);

  if (httpError.status >= 500) {
    logger.error('Unhandled server error', error);
  }

  const body: ErrorResponseBody = {
    error: { code: httpError.code, message: httpError.message },
  };

  res.status(httpError.status).json(body);
};
