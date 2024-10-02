import { writeFile } from 'fs'; // Importing writeFile function from the 'fs' module for file operations
import { promisify } from 'util'; // Importing promisify to convert callback-based functions to promise-based
import Queue from 'bull/lib/queue'; // Importing Queue from Bull for creating job queues
import imgThumbnail from 'image-thumbnail'; // Importing imgThumbnail for generating image thumbnails
import { ObjectID } from 'mongodb'; // Importing ObjectID for MongoDB object ID manipulation
import redisClient from './utils/redis'; // Importing the Redis client for caching or session management
import dbClient from './utils/db'; // Importing the database client for database operations

// Promisifying writeFile to use async/await syntax
const writeFileAsync = promisify(writeFile);

// Creating job queues for thumbnail generation and email sending
const fileQueue = new Queue('thumbnail generation'); // Queue for thumbnail generation jobs
const userQueue = new Queue('email sending'); // Queue for sending email jobs

/**
 * Generates the thumbnail of an image with a given width size.
 * @param {String} filePath The location of the original file.
 * @param {number} size The width of the thumbnail.
 * @returns {Promise<void>}
 */
const generateThumbnail = async (filePath, size) => {
  // Generate a thumbnail and store it in a buffer
  const buffer = await imgThumbnail(filePath, { width: size });
  console.log(`Generating file: ${filePath}, size: ${size}`);
  // Save the thumbnail with a modified filename
  return writeFileAsync(`${filePath}_${size}`, buffer);
};

// Process the file queue for thumbnail generation
fileQueue.process(async (job, done) => {
  const fileId = job.data.fileId || null; // Extracting fileId from the job data
  const userId = job.data.userId || null; // Extracting userId from the job data

  // Validate required fields
  if (!fileId) {
    throw new Error('Missing fileId'); // Error if fileId is missing
  }
  if (!userId) {
    throw new Error('Missing userId'); // Error if userId is missing
  }

  console.log('Processing', job.data.name || ''); // Logging the job name
  const userObjId = new ObjectID(userId); // Converting userId to ObjectID
  const fileObjId = new ObjectID(fileId); // Converting fileId to ObjectID
  const filesCollection = dbClient.db.collection('files'); // Getting the files collection from the database

  // Fetch the file from the database
  const file = await filesCollection.findOne({ _id: fileObjId, userId: userObjId });
  if (!file) {
    throw new Error('File not found'); // Error if the file does not exist
  }

  // Define thumbnail sizes and generate thumbnails concurrently
  const sizes = [500, 250, 100]; // Array of sizes for the thumbnails
  try {
    await Promise.all(sizes.map((size) => generateThumbnail(file.localPath, size))); // Generate all thumbnails
    done(); // Mark job as completed
  } catch (error) {
    console.error(`Error generating thumbnails: ${error.message}`); // Log the error message
    done(error); // Pass the error to done for proper error handling
  }
});

// Process the user queue for sending emails
userQueue.process(async (job, done) => {
  const userId = job.data.userId || null; // Extracting userId from the job data

  // Validate required fields
  if (!userId) {
    throw new Error('Missing userId'); // Error if userId is missing
  }

  const userObjId = new ObjectID(userId); // Converting userId to ObjectID
  const userCollection = dbClient.db.collection('users'); // Getting the users collection from the database

  // Fetch the user from the database
  const existingUser = await userCollection.findOne({ _id: userObjId });
  if (!existingUser) {
    throw new Error('User not found'); // Error if the user does not exist
  }

  console.log(`Welcome ${existingUser.email}!`); // Logging a welcome message with the user's email
  done(); // Mark job as completed
});
