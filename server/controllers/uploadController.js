const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const AppError = require('../utils/AppError');
const {
  getImageExtension,
  getImageExtensionForMime,
} = require('../utils/imageFile');

const UPLOADS_DIR = path.resolve(__dirname, '..', 'uploads');

/**
 * Upload a single event image.
 * Generates a server-side filename and writes buffer to uploads/ directory.
 * POST /api/upload/image
 */
const uploadImage = async (req, res, next) => {
  try {
    if (!req.file) {
      throw new AppError('No image file provided', 400);
    }

    const ext = getImageExtension(req.file.buffer);
    if (!ext || ext !== getImageExtensionForMime(req.file.mimetype)) {
      throw new AppError(
        'Uploaded file content does not match a supported image format',
        400
      );
    }

    const filename = `event-${Date.now()}-${crypto.randomUUID()}.${ext}`;
    const filePath = path.join(UPLOADS_DIR, filename);

    await fs.promises.mkdir(UPLOADS_DIR, { recursive: true });
    await fs.promises.writeFile(filePath, req.file.buffer);

    res.status(201).json({
      success: true,
      data: { url: `/uploads/${filename}` },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Delete an uploaded image by filename.
 * Applies path traversal protection before deletion.
 * DELETE /api/upload/:filename
 */
const deleteImage = async (req, res, next) => {
  try {
    const safeName = path.basename(req.params.filename);
    const filePath = path.resolve(UPLOADS_DIR, safeName);

    if (!filePath.startsWith(UPLOADS_DIR)) {
      throw new AppError('Invalid filename', 400);
    }

    try {
      await fs.promises.access(filePath);
    } catch {
      throw new AppError('File not found', 404);
    }

    await fs.promises.unlink(filePath);

    res.status(200).json({
      success: true,
      message: 'Image deleted successfully',
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { uploadImage, deleteImage };
