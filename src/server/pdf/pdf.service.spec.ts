// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { generateInvoicePdf, generateUpoPdf, looksLikeXml } from './pdf.service';
import { INVOICE_XML, isPdf, UPO_XML } from '../testing/xml-fixtures';

const PDF_TIMEOUT_MS = 30_000;

describe('looksLikeXml', () => {
  it('accepts utf-8 documents', () => {
    expect(looksLikeXml(Buffer.from('<?xml version="1.0"?><Faktura/>'))).toBe(true);
    expect(looksLikeXml(Buffer.from('\n  <Faktura/>'))).toBe(true);
  });

  it('accepts utf-16 documents', () => {
    expect(looksLikeXml(Buffer.from('\uFEFF<Faktura/>', 'utf16le'))).toBe(true);
  });

  it('rejects anything that does not contain a tag opener', () => {
    expect(looksLikeXml(Buffer.from('hello world, this is not xml'))).toBe(false);
    expect(looksLikeXml(Buffer.alloc(0))).toBe(false);
  });
});

describe('generateInvoicePdf', () => {
  it(
    'renders the FA(3) sample invoice',
    async () => {
      const pdf = await generateInvoicePdf(
        { content: INVOICE_XML, filename: 'invoice.pdf' },
        { nrKSeF: '5555555555-20250808-9231003CA67B-BE' }
      );

      expect(isPdf(pdf)).toBe(true);
      expect(pdf.length).toBeGreaterThan(1000);
    },
    PDF_TIMEOUT_MS
  );

  it('rejects an empty document', async () => {
    await expect(
      generateInvoicePdf({ content: Buffer.alloc(0), filename: 'invoice.pdf' }, { nrKSeF: '' })
    ).rejects.toMatchObject({ status: 400, code: 'EMPTY_XML' });
  });

  it('rejects a document that is not xml', async () => {
    await expect(
      generateInvoicePdf({ content: Buffer.from('not xml at all'), filename: 'invoice.pdf' }, { nrKSeF: '' })
    ).rejects.toMatchObject({ status: 400, code: 'INVALID_XML' });
  });

  it('rejects an unsupported schema', async () => {
    await expect(
      generateInvoicePdf({ content: Buffer.from('<Faktura/>'), filename: 'invoice.pdf' }, { nrKSeF: '' })
    ).rejects.toMatchObject({ status: 400, code: 'UNSUPPORTED_XML_SCHEMA' });
  });
});

describe('generateUpoPdf', () => {
  it(
    'renders the UPO sample document',
    async () => {
      const pdf = await generateUpoPdf({ content: UPO_XML, filename: 'upo.pdf' });

      expect(isPdf(pdf)).toBe(true);
      expect(pdf.length).toBeGreaterThan(1000);
    },
    PDF_TIMEOUT_MS
  );

  it(
    'rejects a document that is not an UPO',
    async () => {
      await expect(generateUpoPdf({ content: INVOICE_XML, filename: 'upo.pdf' })).rejects.toMatchObject({
        status: 400,
        code: 'INVALID_XML',
      });
    },
    PDF_TIMEOUT_MS
  );

  it('rejects an empty document', async () => {
    await expect(generateUpoPdf({ content: Buffer.alloc(0), filename: 'upo.pdf' })).rejects.toMatchObject({
      status: 400,
      code: 'EMPTY_XML',
    });
  });
});
