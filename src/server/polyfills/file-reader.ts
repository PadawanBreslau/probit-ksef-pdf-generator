type FileReaderResult = string | ArrayBuffer | null;
type FileReaderEventHandler = ((event: { target: NodeFileReader }) => void) | null;

const EMPTY = 0;
const LOADING = 1;
const DONE = 2;

/**
 * Minimal `FileReader` implementation for Node.js runtimes.
 *
 * The PDF generating code shared with the browser build reads XML through the
 * DOM `FileReader` API, which Node.js does not expose. Only the subset actually
 * used by `parseXML` (`readAsText` + `onload`/`onerror`) is implemented.
 */
export class NodeFileReader {
  public static readonly DONE = DONE;
  public static readonly EMPTY = EMPTY;
  public static readonly LOADING = LOADING;

  public readonly DONE = DONE;
  public readonly EMPTY = EMPTY;
  public readonly LOADING = LOADING;

  public error: DOMException | Error | null = null;
  public onerror: FileReaderEventHandler = null;
  public onload: FileReaderEventHandler = null;
  public onloadend: FileReaderEventHandler = null;
  public readyState: number = EMPTY;
  public result: FileReaderResult = null;

  public abort(): void {
    this.readyState = DONE;
    this.result = null;
  }

  public readAsText(blob: Blob, encoding?: string): void {
    this.readyState = LOADING;

    void blob
      .arrayBuffer()
      .then((buffer: ArrayBuffer): void => {
        this.result = decodeText(buffer, encoding);
        this.readyState = DONE;
        this.onload?.({ target: this });
        this.onloadend?.({ target: this });
      })
      .catch((error: unknown): void => {
        this.error = error instanceof Error ? error : new Error(String(error));
        this.result = null;
        this.readyState = DONE;
        this.onerror?.({ target: this });
        this.onloadend?.({ target: this });
      });
  }
}

export function decodeText(buffer: ArrayBuffer, encoding?: string): string {
  const label = encoding?.trim() || 'utf-8';

  try {
    return new TextDecoder(label).decode(buffer);
  } catch {
    return new TextDecoder('utf-8').decode(buffer);
  }
}

/**
 * Registers the `FileReader` polyfill on `globalThis` when the runtime does not
 * provide one. Environments that already expose `FileReader` (browsers, jsdom)
 * are left untouched.
 */
export function installFileReaderPolyfill(target: typeof globalThis = globalThis): boolean {
  if (typeof (target as { FileReader?: unknown }).FileReader !== 'undefined') {
    return false;
  }

  (target as { FileReader?: unknown }).FileReader = NodeFileReader;

  return true;
}
