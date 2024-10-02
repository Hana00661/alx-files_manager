import { ObjectId } from 'mongodb';
import mime from 'mime-types';
import Queue from 'bull';
import userUtils from '../utils/user';
import fileUtils from '../utils/file';
import basicUtils from '../utils/basic';

// Default folder path to store files, can be overridden by environment variable
const FOLDER_PATH = process.env.FOLDER_PATH || '/tmp/files_manager';

// Create a queue for file processing tasks
const fileQueue = new Queue('fileQueue');

class FilesController {
  /**
   * Create a new file or folder in the database and disk
   * 
   * - First, it checks if the user is authenticated using a token.
   * - The file parameters like name, type, and optional parentId are extracted from the request body.
   * - Based on these parameters, the function handles file/folder creation and stores file content locally.
   * - If the type is a folder, it adds a folder to the DB; if a file or image, it stores the file and adds its metadata to the DB.
   * - If an image is being uploaded, it adds the task to a queue for further processing.
   */
  static async postUpload(request, response) {
    const { userId } = await userUtils.getUserIdAndKey(request);  // Get user ID from the request token

    // If user ID is invalid, respond with a 401 Unauthorized error
    if (!basicUtils.isValidId(userId)) {
      return response.status(401).send({ error: 'Unauthorized' });
    }

    // Add task to the queue for image uploads when no user ID is found
    if (!userId && request.body.type === 'image') {
      await fileQueue.add({});
    }

    const user = await userUtils.getUser({ _id: ObjectId(userId) });  // Fetch the user by userId

    // If user does not exist, return 401 Unauthorized
    if (!user) return response.status(401).send({ error: 'Unauthorized' });

    // Validate the file parameters (e.g., name, type, etc.)
    const { error: validationError, fileParams } = await fileUtils.validateBody(request);

    // If validation fails, return 400 Bad Request
    if (validationError) { return response.status(400).send({ error: validationError }); }

    // Check if parentId is valid when it is not set to root (0)
    if (fileParams.parentId !== 0 && !basicUtils.isValidId(fileParams.parentId)) {
      return response.status(400).send({ error: 'Parent not found' });
    }

    // Save the file locally and store its metadata in the DB
    const { error, code, newFile } = await fileUtils.saveFile(userId, fileParams, FOLDER_PATH);

    // If there is an error saving the file, return an appropriate error response
    if (error) {
      if (response.body.type === 'image') await fileQueue.add({ userId });  // Add to queue for images
      return response.status(code).send(error);
    }

    // For images, add to the fileQueue for additional processing
    if (fileParams.type === 'image') {
      await fileQueue.add({
        fileId: newFile.id.toString(),
        userId: newFile.userId.toString(),
      });
    }

    // Return the newly created file object with a 201 Created status
    return response.status(201).send(newFile);
  }

  /**
   * Retrieve a specific file document by its ID
   * 
   * - Fetches user details using the token.
   * - Checks if the file exists and belongs to the authenticated user.
   * - If found, returns the file metadata; if not, returns appropriate error messages.
   */
  static async getShow(request, response) {
    const fileId = request.params.id;  // Get file ID from request parameters
    const { userId } = await userUtils.getUserIdAndKey(request);  // Get user ID from token

    const user = await userUtils.getUser({ _id: ObjectId(userId) });  // Fetch the user by userId

    // Return 401 Unauthorized if the user is not found
    if (!user) return response.status(401).send({ error: 'Unauthorized' });

    // Validate fileId and userId, return 404 Not Found if invalid
    if (!basicUtils.isValidId(fileId) || !basicUtils.isValidId(userId)) {
      return response.status(404).send({ error: 'Not found' });
    }

    // Get the file from the database for the authenticated user
    const result = await fileUtils.getFile({ _id: ObjectId(fileId), userId: ObjectId(userId) });

    // If file not found, return 404 Not Found
    if (!result) return response.status(404).send({ error: 'Not found' });

    // Process and return the file metadata
    const file = fileUtils.processFile(result);
    return response.status(200).send(file);
  }

  /**
   * List all files of a user based on a specific parentId with pagination
   * 
   * - Retrieves user details using the token.
   * - Lists all files under a specified parentId and paginates the results.
   * - Pagination ensures that only 20 files are listed per page.
   */
  static async getIndex(request, response) {
    const { userId } = await userUtils.getUserIdAndKey(request);  // Get user ID from token
    const user = await userUtils.getUser({ _id: ObjectId(userId) });  // Fetch the user by userId

    // Return 401 Unauthorized if the user is not found
    if (!user) return response.status(401).send({ error: 'Unauthorized' });

    // Get parentId from query parameters (defaults to 0 = root)
    let parentId = request.query.parentId || '0';
    if (parentId === '0') parentId = 0;

    // Get page number from query parameters (defaults to 0)
    let page = Number(request.query.page) || 0;
    if (Number.isNaN(page)) page = 0;

    // Validate parentId if not root, return empty list if invalid or not a folder
    if (parentId !== 0 && parentId !== '0') {
      if (!basicUtils.isValidId(parentId)) { return response.status(401).send({ error: 'Unauthorized' }); }

      parentId = ObjectId(parentId);
      const folder = await fileUtils.getFile({ _id: ObjectId(parentId) });
      if (!folder || folder.type !== 'folder') { return response.status(200).send([]); }
    }

    // Build MongoDB query pipeline for pagination (skip and limit)
    const pipeline = [
      { $match: { parentId } },
      { $skip: page * 20 },
      { $limit: 20 },
    ];

    // Execute query to fetch files
    const fileCursor = await fileUtils.getFilesOfParentId(pipeline);

    const fileList = [];
    await fileCursor.forEach((doc) => {
      const document = fileUtils.processFile(doc);  // Process each file
      fileList.push(document);
    });

    // Return the list of files for the specified parentId
    return response.status(200).send(fileList);
  }

  /**
   * Publish a file, making it publicly accessible
   * 
   * - Updates the `isPublic` field of the file document to true.
   * - Requires user authentication and verifies ownership of the file.
   */
  static async putPublish(request, response) {
    const { error, code, updatedFile } = await fileUtils.publishUnpublish(request, true);  // Mark file as public

    // Handle errors during publish operation
    if (error) return response.status(code).send({ error });

    // Return the updated file document
    return response.status(code).send(updatedFile);
  }

  /**
   * Unpublish a file, making it private (not publicly accessible)
   * 
   * - Updates the `isPublic` field of the file document to false.
   * - Requires user authentication and verifies ownership of the file.
   */
  static async putUnpublish(request, response) {
    const { error, code, updatedFile } = await fileUtils.publishUnpublish(request, false);  // Mark file as private

    // Handle errors during unpublish operation
    if (error) return response.status(code).send({ error });

    // Return the updated file document
    return response.status(code).send(updatedFile);
  }

  /**
   * Retrieve and return the content of a file by its ID
   * 
   * - Fetches the file document by ID and ensures it belongs to the user or is public.
   * - If valid, it returns the content with the appropriate MIME type.
   * - If the file is a folder, it returns a 400 error.
   */
  static async getFile(request, response) {
    const { userId } = await userUtils.getUserIdAndKey(request);  // Get user ID from token
    const { id: fileId } = request.params;  // Get file ID from request parameters
    const size = request.query.size || 0;  // Optional size query parameter

    // Validate fileId, return 404 Not Found if invalid
    if (!basicUtils.isValidId(fileId)) { return response.status(404).send({ error: 'Not found' }); }

    // Fetch the file by fileId
    const file = await fileUtils.getFile({
      _id: ObjectId(fileId),
      $or: [
        { userId: ObjectId(userId) },
        { isPublic: true },
      ],
    });

    // Return 404 Not Found if file does not exist
    if (!file) return response.status(404).send({ error: 'Not found' });

    // Return 400 Bad Request if the file is a folder (folders cannot be downloaded)
    if (file.type === 'folder') return response.status(400).send({ error: "A folder doesn't have content" });

    // Get the local path for the file
    const path = fileUtils.getLocalPath(file, size);

    // Get the MIME type of the file
    const mimeType = mime.lookup(file.name);

    // Send the file content as a response with the appropriate MIME type
    return response.header('Content-Type', mimeType).status(200).sendFile(path);
  }
}

export default FilesController;
