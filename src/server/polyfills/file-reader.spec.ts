// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { decodeText, installFileReaderPolyfill, NodeFileReader } from './file-reader';

function readText(blob: Blob, encoding?: string): Promise<string> {
  return new Promise((resolve, reject): void => {
    const reader = new NodeFileReader();

    reader.onload = (): void => resolve(reader.result as string);
    reader.onerror = (): void => reject(reader.error);
    reader.readAsText(blob, encoding);
  });
}

describe('decodeText', () => {
  it('decodes utf-8 by default', () => {
    expect(decodeText(new TextEncoder().encode('zażółć').buffer as ArrayBuffer)).toBe('zażółć');
  });

  it('decodes utf-16 little endian content', () => {
    const buffer = Buffer.from('<Faktura/>', 'utf16le');

    expect(decodeText(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength), 'utf-16le')).toBe(
      '<Faktura/>'
    );
  });

  it('falls back to utf-8 for unknown encodings', () => {
    expect(decodeText(new TextEncoder().encode('abc').buffer as ArrayBuffer, 'definitely-not-an-encoding')).toBe('abc');
  });
});

describe('NodeFileReader', () => {
  it('reads the text content of a blob', async () => {
    await expect(readText(new Blob(['<Faktura/>']))).resolves.toBe('<Faktura/>');
  });

  it('reads utf-16 encoded content', async () => {
    const blob = new Blob([new Uint8Array(Buffer.from('\uFEFF<Faktura/>', 'utf16le'))]);

    await expect(readText(blob, 'utf-16le')).resolves.toBe('<Faktura/>');
  });

  it('reports the ready state while and after reading', async () => {
    const reader = new NodeFileReader();

    expect(reader.readyState).toBe(NodeFileReader.EMPTY);

    const done = new Promise<void>((resolve): void => {
      reader.onload = (): void => resolve();
    });

    reader.readAsText(new Blob(['<a/>']));
    expect(reader.readyState).toBe(NodeFileReader.LOADING);

    await done;
    expect(reader.readyState).toBe(NodeFileReader.DONE);
    expect(reader.result).toBe('<a/>');
  });

  it('calls onerror when the blob cannot be read', async () => {
    const failing = { arrayBuffer: (): Promise<ArrayBuffer> => Promise.reject(new Error('boom')) } as Blob;

    await expect(readText(failing)).rejects.toThrow('boom');
  });

  it('resets the result on abort', () => {
    const reader = new NodeFileReader();

    reader.result = 'something';
    reader.abort();

    expect(reader.result).toBeNull();
    expect(reader.readyState).toBe(NodeFileReader.DONE);
  });
});

describe('installFileReaderPolyfill', () => {
  it('installs FileReader when the runtime does not provide one', () => {
    const target = {} as typeof globalThis;

    expect(installFileReaderPolyfill(target)).toBe(true);
    expect((target as unknown as { FileReader: unknown }).FileReader).toBe(NodeFileReader);
  });

  it('does not overwrite an existing FileReader implementation', () => {
    const existing = class {};
    const target = { FileReader: existing } as unknown as typeof globalThis;

    expect(installFileReaderPolyfill(target)).toBe(false);
    expect((target as unknown as { FileReader: unknown }).FileReader).toBe(existing);
  });
});
