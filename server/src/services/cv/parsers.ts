import mammoth from 'mammoth';
import { PDFParse } from 'pdf-parse';
import { AppError } from '../../utils/AppError';

export const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
] as const;

export type CvMimeType = (typeof ALLOWED_MIME_TYPES)[number];

/**
 * Detects the actual file type from magic bytes and extracts readable text.
 * The client's claimed MIME type is only used as a hint — verification is
 * always done against the real file content.
 */
export async function extractCvText(buffer: Buffer, _mimeType: string): Promise<string> {
  const detected = detectMagicType(buffer);
  if (!detected) {
    throw new AppError(
      400,
      'Unsupported file type. Only PDF and DOCX resumes are accepted.',
    );
  }

  if (detected === 'pdf') {
    const pdf = new PDFParse({ data: buffer });
    try {
      const result = await pdf.getText();
      const text = result.text.trim();
      if (!text) {
        throw new AppError(400, 'No extractable text found in this PDF (it may be a scanned image).');
      }
      return text;
    } finally {
      await pdf.destroy().catch(() => undefined);
    }
  }

  const result = await mammoth.extractRawText({ buffer });
  const text = result.value.trim();
  if (!text) {
    throw new AppError(400, 'No extractable text found in this DOCX file.');
  }
  return text;
}

/**
 * Magic-byte verification so the client's claimed MIME type is never trusted:
 *  - PDF  → starts with "%PDF" (25 50 44 46)
 *  - DOCX → ZIP container (PK\x03\x04) which holds the OOXML package.
 */
export function detectMagicType(buffer: Buffer): 'pdf' | 'docx' | null {
  if (buffer.length > 4 && buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46) {
    return 'pdf';
  }
  if (buffer.length > 2 && buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04) {
    return 'docx';
  }
  return null;
}

/** Display extension used when persisting the uploaded file. */
export function extensionFor(detected: 'pdf' | 'docx'): string {
  return detected === 'pdf' ? 'pdf' : 'docx';
}