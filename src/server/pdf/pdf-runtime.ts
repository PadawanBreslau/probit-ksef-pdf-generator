import pdfMake from 'pdfmake/build/pdfmake';
import vfs from 'pdfmake/build/vfs_fonts';
import { TFontDictionary } from 'pdfmake/interfaces';
import { configureFonts } from '../../lib-public';

interface PdfMakeAccessPolicies {
  localAccessPolicy?: (path: string) => boolean;
  setUrlAccessPolicy?: (callback: (url: string) => boolean) => void;
}

export const ROBOTO_FONTS: TFontDictionary = {
  Roboto: {
    normal: 'Roboto-Regular.ttf',
    bold: 'Roboto-Medium.ttf',
    italics: 'Roboto-Italic.ttf',
    bolditalics: 'Roboto-MediumItalic.ttf',
  },
};

let initialized = false;

/**
 * Denies every external (URL) and local file system lookup performed by pdfmake.
 *
 * Document definitions are built from untrusted XML uploads, so the renderer must
 * never be able to fetch remote resources or read files from disk.
 */
function denyResourceAccess(): void {
  const pdf = pdfMake as unknown as PdfMakeAccessPolicies;

  pdf.setUrlAccessPolicy?.((): boolean => false);
  pdf.localAccessPolicy = (): boolean => false;
}

/**
 * Registers the Roboto fonts shipped with pdfmake in its virtual file system.
 *
 * In the browser the host application provides the fonts through `configureFonts`;
 * on the server there is no host application, so the bundled defaults are used.
 */
export function initializePdfRuntime(): void {
  if (initialized) {
    return;
  }

  configureFonts({ vfs, fonts: ROBOTO_FONTS });
  denyResourceAccess();

  initialized = true;
}

export function resetPdfRuntimeForTests(): void {
  initialized = false;
}
