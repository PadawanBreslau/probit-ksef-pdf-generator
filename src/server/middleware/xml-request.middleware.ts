import express, { Request, RequestHandler } from 'express';
import multer from 'multer';
import { AdditionalDataTypes } from '../../lib-public/types/common.types';
import { badRequest, unsupportedMediaType } from '../errors/http-error';
import { XmlDocument } from '../pdf/pdf.service';

export const XML_FIELD_NAME = 'file';

const MULTIPART_PATTERN = /^multipart\/form-data$/i;
const XML_CONTENT_TYPE_PATTERN = /^(application|text)\/([\w.-]+\+)?xml$/i;
const MAX_FILENAME_LENGTH = 100;

function getMediaType(req: Request): string {
  return (req.headers['content-type'] ?? '').split(';')[0].trim().toLowerCase();
}

export function isXmlContentType(req: Request): boolean {
  return XML_CONTENT_TYPE_PATTERN.test(getMediaType(req));
}

export function isMultipartContentType(req: Request): boolean {
  return MULTIPART_PATTERN.test(getMediaType(req));
}

/**
 * Accepts the XML payload either as a `multipart/form-data` upload (field `file`)
 * or as a raw `application/xml` / `text/xml` request body.
 */
export function createXmlBodyParser(maxUploadSizeBytes: number): RequestHandler {
  const multipartParser: RequestHandler = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: maxUploadSizeBytes, files: 1 },
  }).single(XML_FIELD_NAME);

  const rawParser: RequestHandler = express.raw({
    type: isXmlContentType,
    limit: maxUploadSizeBytes,
  });

  return (req, res, next): void => {
    if (isMultipartContentType(req)) {
      multipartParser(req, res, next);

      return;
    }

    if (isXmlContentType(req)) {
      rawParser(req, res, next);

      return;
    }

    next(
      unsupportedMediaType(
        `Unsupported Content-Type. Send the XML document as multipart/form-data (field "${XML_FIELD_NAME}") or as a raw application/xml body.`
      )
    );
  };
}

/**
 * Removes directory components and characters that are unsafe inside a
 * `Content-Disposition` header, then forces the `.pdf` extension.
 */
export function toPdfFilename(originalName: string | undefined, fallback: string): string {
  const base = (originalName ?? '')
    .replace(/\\/g, '/')
    .split('/')
    .pop()!
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f"\\]/g, '')
    .replace(/\.xml$/i, '')
    .trim()
    .slice(0, MAX_FILENAME_LENGTH)
    .trim();

  return base === '' ? fallback : `${base}.pdf`;
}

export function readXmlDocument(req: Request, fallbackFilename: string): XmlDocument {
  if (req.file) {
    return {
      content: req.file.buffer,
      filename: toPdfFilename(req.file.originalname, fallbackFilename),
    };
  }

  if (Buffer.isBuffer(req.body) && req.body.length > 0) {
    return { content: req.body, filename: fallbackFilename };
  }

  throw badRequest(
    `Missing XML document. Send it as multipart/form-data (field "${XML_FIELD_NAME}") or as a raw application/xml body.`,
    'MISSING_XML'
  );
}

function readString(source: unknown, key: string): string | undefined {
  if (typeof source !== 'object' || source === null) {
    return undefined;
  }

  const value = (source as Record<string, unknown>)[key];

  return typeof value === 'string' && value.trim() !== '' ? value : undefined;
}

function readField(req: Request, key: string): string | undefined {
  return readString(Buffer.isBuffer(req.body) ? undefined : req.body, key) ?? readString(req.query, key);
}

/**
 * Reads the optional invoice metadata from multipart fields or the query string.
 * Multipart fields take precedence over query parameters.
 */
export function readAdditionalData(req: Request): AdditionalDataTypes {
  const isMobile = readField(req, 'isMobile');

  return {
    nrKSeF: readField(req, 'nrKSeF') ?? '',
    acDate: readField(req, 'acDate'),
    qrCode: readField(req, 'qrCode'),
    qr2Code: readField(req, 'qr2Code'),
    watermark: readField(req, 'watermark'),
    isMobile: isMobile === undefined ? undefined : isMobile === 'true' || isMobile === '1',
  };
}
