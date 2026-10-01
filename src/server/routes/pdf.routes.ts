import { NextFunction, Request, RequestHandler, Response, Router } from 'express';
import { ServerConfig } from '../config';
import {
  createXmlBodyParser,
  readAdditionalData,
  readXmlDocument,
} from '../middleware/xml-request.middleware';
import { generateInvoicePdf, generateUpoPdf } from '../pdf/pdf.service';

const PDF_MEDIA_TYPE = 'application/pdf';

function asyncHandler(handler: (req: Request, res: Response) => Promise<void>): RequestHandler {
  return (req, res, next: NextFunction): void => {
    handler(req, res).catch(next);
  };
}

function sendPdf(res: Response, pdf: Buffer, filename: string): void {
  res.setHeader('Content-Type', PDF_MEDIA_TYPE);
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-Length', pdf.length.toString());
  res.send(pdf);
}

export function createPdfRouter(config: ServerConfig): Router {
  const router = Router();
  const parseXmlBody = createXmlBodyParser(config.maxUploadSizeBytes);

  router.post(
    '/invoices/pdf',
    parseXmlBody,
    asyncHandler(async (req, res): Promise<void> => {
      const document = readXmlDocument(req, 'invoice.pdf');
      const pdf = await generateInvoicePdf(document, readAdditionalData(req));

      sendPdf(res, pdf, document.filename);
    })
  );

  router.post(
    '/upo/pdf',
    parseXmlBody,
    asyncHandler(async (req, res): Promise<void> => {
      const document = readXmlDocument(req, 'upo.pdf');
      const pdf = await generateUpoPdf(document);

      sendPdf(res, pdf, document.filename);
    })
  );

  return router;
}
