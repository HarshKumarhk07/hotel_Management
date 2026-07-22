import { v2 as cloudinary } from 'cloudinary';
import { env } from '@/config/env';
import { logger } from '@/config/logger';
import { AppError } from '@/utils/AppError';

let configured = false;

function ensureConfigured(): void {
  if (configured) return;
  if (!env.CLOUDINARY_CLOUD_NAME || !env.CLOUDINARY_API_KEY || !env.CLOUDINARY_API_SECRET) {
    throw AppError.badRequest('Image uploads are not configured', 'CLOUDINARY_DISABLED');
  }
  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
    secure: true,
  });
  configured = true;
}

export interface UploadedImage {
  url: string;
  publicId: string;
}

/**
 * Upload an image buffer to Cloudinary under a folder, returning the secure URL
 * and public id (stored on the menu item so the image can be replaced/deleted).
 */
export function uploadImage(buffer: Buffer, folder = 'kds/menu'): Promise<UploadedImage> {
  ensureConfigured();
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: 'image',
        quality: 'auto',
        fetch_format: 'auto',
      },
      (err, result) => {
        if (err || !result) {
          logger.error({ err, errDetail: err?.message, errHttp: (err as any)?.http_code }, 'Cloudinary upload failed');
          reject(AppError.internal(
            err?.message ?? 'Image upload failed',
            'UPLOAD_FAILED',
          ));
          return;
        }
        resolve({ url: result.secure_url, publicId: result.public_id });
      },
    );
    stream.end(buffer);
  });
}

/**
 * Upload an arbitrary file (like a PDF) to Cloudinary.
 */
export function uploadFile(buffer: Buffer, folder = 'kds/docs'): Promise<UploadedImage> {
  ensureConfigured();
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: 'auto',
      },
      (err, result) => {
        if (err || !result) {
          logger.error({ err, errDetail: err?.message, errHttp: (err as any)?.http_code }, 'Cloudinary upload failed');
          reject(AppError.internal(
            err?.message ?? 'File upload failed',
            'UPLOAD_FAILED',
          ));
          return;
        }
        resolve({ url: result.secure_url, publicId: result.public_id });
      },
    );
    stream.end(buffer);
  });
}

export async function deleteImage(publicId: string): Promise<void> {
  ensureConfigured();
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (err) {
    // Non-fatal: log and move on so a failed cleanup doesn't block the request.
    logger.warn({ err, publicId }, 'Cloudinary delete failed');
  }
}
