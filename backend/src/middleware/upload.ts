import multer from 'multer';
import { AppError } from '@/utils/AppError';

const ALLOWED_IMAGES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif']);
const ALLOWED_DOCS = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'application/pdf']);

/**
 * In-memory multipart handling for menu images. We keep the buffer in memory
 * (no disk writes) and stream it straight to Cloudinary. 5 MB cap, image MIME
 * types only.
 */
export const uploadImage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_IMAGES.has(file.mimetype)) return cb(null, true);
    cb(AppError.badRequest('Only JPEG, PNG, WebP, or AVIF images are allowed', 'BAD_IMAGE_TYPE'));
  },
}).single('image');

/**
 * In-memory multipart handling for documents (like ID proof). Allows PDF and images.
 */
export const uploadDocument = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_DOCS.has(file.mimetype)) return cb(null, true);
    cb(AppError.badRequest('Only JPEG, PNG, WebP, AVIF, or PDF files are allowed', 'BAD_DOC_TYPE'));
  },
}).single('document');
