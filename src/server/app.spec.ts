// @vitest-environment node
import { Express } from 'express';
import request from 'supertest';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { API_PREFIX, createApp } from './app';
import { ServerConfig } from './config';
import { INVOICE_XML, isPdf, UPO_XML } from './testing/xml-fixtures';

const PDF_TIMEOUT_MS = 30_000;

const config: ServerConfig = { host: '127.0.0.1', port: 0, maxUploadSizeBytes: 1024 * 1024 };

let app: Express;

beforeAll(() => {
  vi.stubEnv('LOG_LEVEL', 'silent');
  app = createApp(config);
});

describe('GET /health', () => {
  it('reports the service as healthy', async () => {
    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ status: 'ok' });
    expect(typeof response.body.uptime).toBe('number');
  });

  it('is also exposed under the api prefix', async () => {
    const response = await request(app).get(`${API_PREFIX}/health`);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ status: 'ok' });
  });
});

describe(`POST ${API_PREFIX}/invoices/pdf`, () => {
  it(
    'converts a multipart XML upload into a PDF',
    async () => {
      const response = await request(app)
        .post(`${API_PREFIX}/invoices/pdf`)
        .field('nrKSeF', '5555555555-20250808-9231003CA67B-BE')
        .attach('file', INVOICE_XML, 'faktura.xml');

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toBe('application/pdf');
      expect(response.headers['content-disposition']).toBe('attachment; filename="faktura.pdf"');
      expect(response.headers['content-length']).toBe(String(response.body.length));
      expect(isPdf(response.body)).toBe(true);
    },
    PDF_TIMEOUT_MS
  );

  it(
    'converts a raw XML body into a PDF',
    async () => {
      const response = await request(app)
        .post(`${API_PREFIX}/invoices/pdf`)
        .query({ nrKSeF: '5555555555-20250808-9231003CA67B-BE', acDate: '23.06.2026' })
        .set('Content-Type', 'application/xml')
        .send(INVOICE_XML);

      expect(response.status).toBe(200);
      expect(response.headers['content-disposition']).toBe('attachment; filename="invoice.pdf"');
      expect(isPdf(response.body)).toBe(true);
    },
    PDF_TIMEOUT_MS
  );

  it('rejects an unsupported content type', async () => {
    const response = await request(app)
      .post(`${API_PREFIX}/invoices/pdf`)
      .set('Content-Type', 'application/json')
      .send('{}');

    expect(response.status).toBe(415);
    expect(response.body.error.code).toBe('UNSUPPORTED_MEDIA_TYPE');
  });

  it('rejects a multipart request without a file', async () => {
    const response = await request(app).post(`${API_PREFIX}/invoices/pdf`).field('nrKSeF', 'KSEF-1');

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('MISSING_XML');
  });

  it('rejects a file sent in an unexpected field', async () => {
    const response = await request(app)
      .post(`${API_PREFIX}/invoices/pdf`)
      .attach('document', INVOICE_XML, 'faktura.xml');

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('UNEXPECTED_FILE_FIELD');
  });

  it('rejects a body that is not XML', async () => {
    const response = await request(app)
      .post(`${API_PREFIX}/invoices/pdf`)
      .set('Content-Type', 'application/xml')
      .send('this is definitely not xml');

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('INVALID_XML');
  });

  it('rejects an XML document with an unknown schema', async () => {
    const response = await request(app)
      .post(`${API_PREFIX}/invoices/pdf`)
      .set('Content-Type', 'application/xml')
      .send('<Faktura><Naglowek/></Faktura>');

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('UNSUPPORTED_XML_SCHEMA');
  });

  it('rejects an upload that exceeds the configured limit', async () => {
    const smallApp = createApp({ ...config, maxUploadSizeBytes: 64 });

    const response = await request(smallApp)
      .post(`${API_PREFIX}/invoices/pdf`)
      .attach('file', INVOICE_XML, 'faktura.xml');

    expect(response.status).toBe(413);
    expect(response.body.error.code).toBe('PAYLOAD_TOO_LARGE');
  });

  it('rejects a raw body that exceeds the configured limit', async () => {
    const smallApp = createApp({ ...config, maxUploadSizeBytes: 64 });

    const response = await request(smallApp)
      .post(`${API_PREFIX}/invoices/pdf`)
      .set('Content-Type', 'application/xml')
      .send(INVOICE_XML);

    expect(response.status).toBe(413);
    expect(response.body.error.code).toBe('PAYLOAD_TOO_LARGE');
  });
});

describe(`POST ${API_PREFIX}/upo/pdf`, () => {
  it(
    'converts an UPO upload into a PDF',
    async () => {
      const response = await request(app).post(`${API_PREFIX}/upo/pdf`).attach('file', UPO_XML, 'upo.xml');

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toBe('application/pdf');
      expect(response.headers['content-disposition']).toBe('attachment; filename="upo.pdf"');
      expect(isPdf(response.body)).toBe(true);
    },
    PDF_TIMEOUT_MS
  );

  it(
    'rejects a document that is not an UPO',
    async () => {
      const response = await request(app)
        .post(`${API_PREFIX}/upo/pdf`)
        .set('Content-Type', 'application/xml')
        .send(INVOICE_XML);

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('INVALID_XML');
    },
    PDF_TIMEOUT_MS
  );
});

describe('unknown routes', () => {
  it('returns a JSON 404 payload', async () => {
    const response = await request(app).get('/does-not-exist');

    expect(response.status).toBe(404);
    expect(response.body.error).toMatchObject({ code: 'NOT_FOUND' });
  });

  it('sets hardening headers', async () => {
    const response = await request(app).get('/health');

    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['referrer-policy']).toBe('no-referrer');
    expect(response.headers['x-powered-by']).toBeUndefined();
  });
});
