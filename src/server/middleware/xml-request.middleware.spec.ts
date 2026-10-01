// @vitest-environment node
import { Request } from 'express';
import { describe, expect, it } from 'vitest';
import { HttpError } from '../errors/http-error';
import {
  isMultipartContentType,
  isXmlContentType,
  readAdditionalData,
  readXmlDocument,
  toPdfFilename,
} from './xml-request.middleware';

function fakeRequest(partial: Partial<Request> & { headers?: Record<string, string> }): Request {
  return { headers: {}, query: {}, ...partial } as Request;
}

describe('content type detection', () => {
  it.each([
    ['application/xml', true],
    ['text/xml', true],
    ['application/xml; charset=utf-8', true],
    ['APPLICATION/XML', true],
    ['application/atom+xml', true],
    ['application/json', false],
    ['multipart/form-data', false],
    ['', false],
  ])('detects %s as xml: %s', (contentType, expected) => {
    expect(isXmlContentType(fakeRequest({ headers: { 'content-type': contentType } }))).toBe(expected);
  });

  it.each([
    ['multipart/form-data', true],
    ['multipart/form-data; boundary=----x', true],
    ['application/xml', false],
  ])('detects %s as multipart: %s', (contentType, expected) => {
    expect(isMultipartContentType(fakeRequest({ headers: { 'content-type': contentType } }))).toBe(expected);
  });

  it('treats a missing content type as unsupported', () => {
    expect(isXmlContentType(fakeRequest({}))).toBe(false);
    expect(isMultipartContentType(fakeRequest({}))).toBe(false);
  });
});

describe('toPdfFilename', () => {
  it('replaces the xml extension with pdf', () => {
    expect(toPdfFilename('invoice.xml', 'fallback.pdf')).toBe('invoice.pdf');
    expect(toPdfFilename('INVOICE.XML', 'fallback.pdf')).toBe('INVOICE.pdf');
  });

  it('uses the fallback for missing or blank names', () => {
    expect(toPdfFilename(undefined, 'fallback.pdf')).toBe('fallback.pdf');
    expect(toPdfFilename('   ', 'fallback.pdf')).toBe('fallback.pdf');
    expect(toPdfFilename('.xml', 'fallback.pdf')).toBe('fallback.pdf');
  });

  it('strips directory traversal segments', () => {
    expect(toPdfFilename('../../etc/passwd.xml', 'fallback.pdf')).toBe('passwd.pdf');
    expect(toPdfFilename('C:\\temp\\invoice.xml', 'fallback.pdf')).toBe('invoice.pdf');
  });

  it('removes characters that could break the Content-Disposition header', () => {
    expect(toPdfFilename('in"voice\r\n.xml', 'fallback.pdf')).toBe('invoice.pdf');
  });

  it('limits the length of the file name', () => {
    expect(toPdfFilename(`${'a'.repeat(300)}.xml`, 'fallback.pdf')).toBe(`${'a'.repeat(100)}.pdf`);
  });
});

describe('readXmlDocument', () => {
  it('reads an uploaded multipart file', () => {
    const request = fakeRequest({
      file: { buffer: Buffer.from('<a/>'), originalname: 'upload.xml' } as Express.Multer.File,
    });

    expect(readXmlDocument(request, 'invoice.pdf')).toEqual({
      content: Buffer.from('<a/>'),
      filename: 'upload.pdf',
    });
  });

  it('reads a raw xml body', () => {
    const request = fakeRequest({ body: Buffer.from('<a/>') });

    expect(readXmlDocument(request, 'invoice.pdf')).toEqual({
      content: Buffer.from('<a/>'),
      filename: 'invoice.pdf',
    });
  });

  it('throws when nothing was sent', () => {
    expect(() => readXmlDocument(fakeRequest({}), 'invoice.pdf')).toThrow(HttpError);
    expect(() => readXmlDocument(fakeRequest({ body: Buffer.alloc(0) }), 'invoice.pdf')).toThrowError(
      expect.objectContaining({ code: 'MISSING_XML', status: 400 })
    );
  });
});

describe('readAdditionalData', () => {
  it('returns empty metadata when nothing was provided', () => {
    expect(readAdditionalData(fakeRequest({}))).toEqual({
      nrKSeF: '',
      acDate: undefined,
      qrCode: undefined,
      qr2Code: undefined,
      watermark: undefined,
      isMobile: undefined,
    });
  });

  it('reads the metadata from the query string', () => {
    const request = fakeRequest({
      query: { nrKSeF: 'KSEF-1', acDate: '23.06.2026', qrCode: 'a', qr2Code: 'b', watermark: 'DRAFT' },
    });

    expect(readAdditionalData(request)).toMatchObject({
      nrKSeF: 'KSEF-1',
      acDate: '23.06.2026',
      qrCode: 'a',
      qr2Code: 'b',
      watermark: 'DRAFT',
    });
  });

  it('prefers multipart fields over query parameters', () => {
    const request = fakeRequest({ body: { nrKSeF: 'from-body' }, query: { nrKSeF: 'from-query' } });

    expect(readAdditionalData(request).nrKSeF).toBe('from-body');
  });

  it('ignores the body when it holds the raw xml payload', () => {
    const request = fakeRequest({ body: Buffer.from('<a/>'), query: { nrKSeF: 'from-query' } });

    expect(readAdditionalData(request).nrKSeF).toBe('from-query');
  });

  it('ignores blank and non string values', () => {
    const request = fakeRequest({ query: { nrKSeF: '  ', acDate: ['a', 'b'] as unknown as string } });

    expect(readAdditionalData(request)).toMatchObject({ nrKSeF: '', acDate: undefined });
  });

  it('parses the isMobile flag', () => {
    expect(readAdditionalData(fakeRequest({ query: { isMobile: 'true' } })).isMobile).toBe(true);
    expect(readAdditionalData(fakeRequest({ query: { isMobile: '1' } })).isMobile).toBe(true);
    expect(readAdditionalData(fakeRequest({ query: { isMobile: 'false' } })).isMobile).toBe(false);
    expect(readAdditionalData(fakeRequest({ query: {} })).isMobile).toBeUndefined();
  });
});
