const multer = require('multer');
const env = require('../config/env');
const AppError = require('../utils/AppError');

const EVENT_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
];
const PAYMENT_SCREENSHOT_MIME_TYPES = [
  ...EVENT_IMAGE_MIME_TYPES,
  'image/gif',
];

const storage = multer.memoryStorage();

const createFileFilter = (allowedMimeTypes) => (_req, file, cb) => {
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new AppError(
        `Only ${allowedMimeTypes.map((type) => type.split('/')[1].toUpperCase()).join(', ')} images are allowed`,
        400
      ),
      false
    );
  }
};

const createUpload = (maxFileSize, allowedMimeTypes) =>
  multer({
    storage,
    fileFilter: createFileFilter(allowedMimeTypes),
    limits: { fileSize: maxFileSize },
  });

const uploadSingle = createUpload(
  env.UPLOAD_MAX_SIZE,
  EVENT_IMAGE_MIME_TYPES
).single('image');
const uploadPaymentScreenshot = createUpload(
  env.MAX_PAYMENT_SCREENSHOT_SIZE_MB * 1024 * 1024,
  PAYMENT_SCREENSHOT_MIME_TYPES
).single('screenshot');

module.exports = { uploadSingle, uploadPaymentScreenshot };
