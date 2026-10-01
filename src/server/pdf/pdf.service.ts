import { generateInvoice, generatePDFUPO } from '../../lib-public';
import { AdditionalDataTypes } from '../../lib-public/types/common.types';
import { badRequest, HttpError } from '../errors/http-error';
import { installFileReaderPolyfill } from '../polyfills/file-reader';
import { initializePdfRuntime } from './pdf-runtime';

const XML_MEDIA_TYPE = 'application/xml';
const LESS_THAN_BYTE = 0x3c;
const XML_SNIFF_LENGTH = 16;

export interface XmlDocument {
  content: Buffer;
  filename: string;
}

let runtimeReady = false;

function ensureRuntime(): void {
  if (runtimeReady) {
    return;
  }

  installFileReaderPolyfill();
  initializePdfRuntime();

  runtimeReady = true;
}

export function looksLikeXml(content: Buffer): boolean {
  return content.subarray(0, XML_SNIFF_LENGTH).includes(LESS_THAN_BYTE);
}

function toFile({ content, filename }: XmlDocument): File {
  return new File([new Uint8Array(content)], filename, { type: XML_MEDIA_TYPE });
}

function assertRenderableXml(document: XmlDocument): void {
  if (document.content.length === 0) {
    throw badRequest('The uploaded XML document is empty.', 'EMPTY_XML');
  }

  if (!looksLikeXml(document.content)) {
    throw badRequest('The uploaded file is not a valid XML document.', 'INVALID_XML');
  }
}

async function toBuffer(blob: Blob): Promise<Buffer> {
  return Buffer.from(await blob.arrayBuffer());
}

function toGenerationError(error: unknown): HttpError {
  if (error instanceof HttpError) {
    return error;
  }

  const message = error instanceof Error ? error.message : String(error);

  if (message.startsWith('Unknown XML Version')) {
    return badRequest(
      'The XML document does not match any supported schema (FA(1), FA(2), FA(3), FA_RR(1), PEF or UPO).',
      'UNSUPPORTED_XML_SCHEMA'
    );
  }

  return badRequest(`The XML document could not be converted to PDF: ${message}`, 'INVALID_XML');
}

export async function generateInvoicePdf(
  document: XmlDocument,
  additionalData: AdditionalDataTypes
): Promise<Buffer> {
  ensureRuntime();
  assertRenderableXml(document);

  try {
    return await toBuffer(await generateInvoice(toFile(document), additionalData, 'blob'));
  } catch (error: unknown) {
    throw toGenerationError(error);
  }
}

export async function generateUpoPdf(document: XmlDocument): Promise<Buffer> {
  ensureRuntime();
  assertRenderableXml(document);

  try {
    return await toBuffer(await generatePDFUPO(toFile(document)));
  } catch (error: unknown) {
    throw toGenerationError(error);
  }
}
