import multer from 'multer';
import { AppError } from '../utils/AppError';

export const MAX_CV_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

// Multer processes the file into memory (never straight to disk) so the
// parser can verify magic bytes BEFORE anything is persisted.
export const uploadCvMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_CV_SIZE_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    const allowed =
      file.mimetype === 'application/pdf' ||
      file.mimetype ===
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    if (!allowed) {
      cb(new AppError(400, 'Only PDF and DOCX files are supported'));
      return;
    }
    cb(null, true);
  },
});