import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';

const assetsDirectory = fileURLToPath(new URL('../../../assets/', import.meta.url));

export const INVOICE_XML: Buffer = readFileSync(`${assetsDirectory}invoice.xml`);
export const UPO_XML: Buffer = readFileSync(`${assetsDirectory}upo.xml`);

export function isPdf(buffer: Buffer): boolean {
  return buffer.subarray(0, 5).toString('latin1') === '%PDF-';
}
