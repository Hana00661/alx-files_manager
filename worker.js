import { writeFile } from 'fs';
import { promisify } from 'util';
import Queue from 'bull/lib/queue';
import imgThumbnail from 'image-thumbnail';
import { ObjectID } from 'mongodb';
import redisClient from './utils/redis';
import dbClient from './utils/db';

// Promisifying writeFile to use async/await syntax
const writeFileAsync = promisify(writeFile);

// Creating job queues for thumbnail generation and email sending
const fileQueue = new Queue('thumbnail generation');
const userQueue = new Queue('email sending');

/**
 * Generates the thumbnail of an image with a given width size.
 * @param {String} filePath The location of the original file.
 * @param {number} size The width of the thumbnail.
 * @returns {Promise<void>}
 */
const generateThumbnail = async (filePath, size) => {
  const buffer = await imgThumbnail(filePath, { width: size });
  console.log(`Generating file: ${filePath}, size: ${size}`);
  // Save the thumbnail with a modified filename
  return writeFileAsync(`${filePath}_${size}`, buffer);
});

// Process the file queue for thumbnail generation
fileQueue.process(async (job, done) => {
  const fileId = job.data.fileId || null;
  const userId = job.data.userId || null;

  // Validate required fields
  if (!fileId) {
    throw new Error('Missing fileId');
  }
  if (!userId) {
    throw new Error('Missing userId');
  }

  console.log('Processing', job.data.name || '');
  const userObjId = new ObjectID(userId);
  const fileObjId = new ObjectID(fileId);
  const filesCollection = dbClient.db.collection('files');

  // Fetch the file from the database
  const file = await filesCollection.findOne({ _id: fileObjId, userId: userObjId });
  if (!file) {
    throw new Error('File not found');
  }

  // Define thumbnail sizes and generate thumbnails concurrently
  const sizes = [500, 250, 100];
  try {
    await Promise.all(sizes.map((size) => generateThumbnail(file.localPath, size)));
    done(); // Mark job as completed
  } catch (error) {
    console.error(`Error generating thumbnails: ${error.message}`);
    done(error); // Pass the error to done for proper error handling
  }
});

// Process the user queue for sending emails
userQueue.process(async (job, done) => {
  const userId = job.data.userId || null;

  // Validate required fields
  if (!userId) {
    throw new Error('Missing userId');
  }

  const userObjId = new ObjectID(userId);
  const userCollection = dbClient.db.collection('users');

  // Fetch the user from the database
  const existingUser = await userCollection.findOne({ _id: userObjId });
  if (!existingUser) {
    throw new Error('User not found');
  }

  console.log(`Welcome ${existingUser.email}!`);
  done(); // Mark job as completed
});
