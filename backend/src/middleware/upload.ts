import multer from 'multer';
import { AppError } from '@/utils/AppError';

const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif']);

/**
 * In-memory multipart handling for menu images. We keep the buffer in memory
 * (no disk writes) and stream it straight to Cloudinary. 5 MB cap, image MIME
 * types only.
 */
export const uploadImage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED.has(file.mimetype)) return cb(null, true);
    cb(AppError.badRequest('Only JPEG, PNG, WebP, or AVIF images are allowed', 'BAD_IMAGE_TYPE'));
  },
}).single('image');
