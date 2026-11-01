const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const express = require('express');
const { uploadSingle } = require('./middlewares/upload');
const { uploadImage } = require('./controllers/uploadController');
const env = require('./config/env');

const uploadsDirectory = path.resolve(__dirname, 'uploads');

const run = async () => {
  const imageBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  let filename;
  const app = express();
  app.post('/api/upload/image', uploadSingle, uploadImage);
  app.use('/uploads', express.static(uploadsDirectory, { index: false }));
  app.use((error, _req, res, _next) => {
    const statusCode =
      error.statusCode || (error.name === 'MulterError' ? 400 : 500);
    res.status(statusCode).json({ message: error.message });
  });
  const server = await new Promise((resolve) => {
    const listeningServer = app.listen(0, '127.0.0.1', () =>
      resolve(listeningServer)
    );
  });

  try {
    const formData = new FormData();
    formData.append('image', new Blob([imageBuffer], { type: 'image/png' }), 'event.png');
    const uploadResponse = await fetch(
      `http://127.0.0.1:${server.address().port}/api/upload/image`,
      { method: 'POST', body: formData }
    );
    const responseBody = await uploadResponse.json();

    assert.equal(uploadResponse.status, 201);
    assert.equal(responseBody.success, true);
    assert.equal(typeof responseBody.data.url, 'string');
    assert.match(responseBody.data.url, /^\/uploads\/event-.*\.png$/);

    filename = path.basename(responseBody.data.url);
    const storedPath = path.join(uploadsDirectory, filename);
    assert.deepEqual(await fs.readFile(storedPath), imageBuffer);

    const imageResponse = await fetch(
      `http://127.0.0.1:${server.address().port}${responseBody.data.url}`
    );
    assert.equal(imageResponse.status, 200);
    assert.deepEqual(
      Buffer.from(await imageResponse.arrayBuffer()),
      imageBuffer
    );

    const mismatchedImage = new FormData();
    mismatchedImage.append(
      'image',
      new Blob([imageBuffer], { type: 'image/jpeg' }),
      'not-a-jpeg.jpg'
    );
    const mismatchResponse = await fetch(
      `http://127.0.0.1:${server.address().port}/api/upload/image`,
      { method: 'POST', body: mismatchedImage }
    );
    assert.equal(mismatchResponse.status, 400);
    assert.match((await mismatchResponse.json()).message, /does not match/);

    const unsupportedImage = new FormData();
    unsupportedImage.append(
      'image',
      new Blob([imageBuffer], { type: 'text/plain' }),
      'not-an-image.txt'
    );
    const unsupportedResponse = await fetch(
      `http://127.0.0.1:${server.address().port}/api/upload/image`,
      { method: 'POST', body: unsupportedImage }
    );
    assert.equal(unsupportedResponse.status, 400);

    const unsupportedGif = new FormData();
    unsupportedGif.append(
      'image',
      new Blob([Buffer.from('GIF89a')], { type: 'image/gif' }),
      'unsupported.gif'
    );
    const gifResponse = await fetch(
      `http://127.0.0.1:${server.address().port}/api/upload/image`,
      { method: 'POST', body: unsupportedGif }
    );
    assert.equal(gifResponse.status, 400);
    assert.match((await gifResponse.json()).message, /Only JPEG, PNG, WEBP/);

    const oversizedImage = new FormData();
    oversizedImage.append(
      'image',
      new Blob([Buffer.alloc(env.UPLOAD_MAX_SIZE + 1)], { type: 'image/png' }),
      'oversized.png'
    );
    const oversizedResponse = await fetch(
      `http://127.0.0.1:${server.address().port}/api/upload/image`,
      { method: 'POST', body: oversizedImage }
    );
    assert.equal(oversizedResponse.status, 400);

    console.log('Multipart event image upload, storage, response, and static serving checks passed.');
  } finally {
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve()))
    );
    if (filename) {
      await fs.unlink(path.join(uploadsDirectory, filename)).catch((error) => {
        if (error.code !== 'ENOENT') throw error;
      });
    }
  }
};

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
