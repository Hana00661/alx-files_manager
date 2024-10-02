import { ObjectId } from 'mongodb';
import mime from 'mime-types';
import Queue from 'bull';
import userUtils from '../utils/users';
import fileUtils from '../utils/file';
import basicUtils from '../utils/basic';

const FOLDER_PATH = process.env.FOLDER_PATH || '/tmp/files_manager';

// Initialize a Bull queue for file processing
const fileQueue = new Queue('fileQueue');

class FilesController {
  /**
   * Handles the upload of a new file.
   * Validates the user and file parameters, saves the file locally, and updates the database.
   */
  static async postUpload(request, response) {
    const { userId } = await userUtils.getUserIdAndKey(request);

    // Check if the user is authenticated
    if (!basicUtils.isValidId(userId)) {
      return response.status(401).send({ error: 'Unauthorized' });
    }

    // If userId is missing and type is image, add a job to the queue
    if (!userId && request.body.type === 'image') {
      await fileQueue.add({});
    }

    // Retrieve user details from the database
    const user = await userUtils.getUser({
      _id: ObjectId(userId),
    });

    // If user is not found, return Unauthorized error
    if (!user) return response.status(401).send({ error: 'Unauthorized' });

    // Validate the request body for file parameters
    const { error: validationError, fileParams } = await fileUtils.validateBody(request);

    // If validation fails, return an error response
    if (validationError) {
      return response.status(400).send({ error: validationError });
    }

    // Validate parentId if it is set
    if (fileParams.parentId !== 0 && !basicUtils.isValidId(fileParams.parentId)) {
      return response.status(400).send({ error: 'Parent not found' });
    }

    // Save the file and get the result
    const { error, code, newFile } = await fileUtils.saveFile(
      userId,
      fileParams,
      FOLDER_PATH,
    );

    // Handle any errors during file saving
    if (error) {
      if (response.body.type === 'image') await fileQueue.add({ userId });
      return response.status(code).send(error);
    }

    // If the file is an image, add it to the processing queue
    if (fileParams.type === 'image') {
      await fileQueue.add({
        fileId: newFile.id.toString(),
        userId: newFile.userId.toString(),
      });
    }

    // Return the newly created file document with a 201 status
    return response.status(201).send(newFile);
  }

  /**
   * Retrieves a specific file document based on the file ID.
   * Ensures the user is authenticated and authorized to access the file.
   */
  static async getShow(request, response) {
    const fileId = request.params.id;

    // Get the user ID from the request token
    const { userId } = await userUtils.getUserIdAndKey(request);

    // Retrieve user details
    const user = await userUtils.getUser({
      _id: ObjectId(userId),
    });

    // If user is not found, return Unauthorized error
    if (!user) return response.status(401).send({ error: 'Unauthorized' });

    // Validate the fileId and userId
    if (!basicUtils.isValidId(fileId) || !basicUtils.isValidId(userId)) {
      return response.status(404).send({ error: 'Not found' });
    }

    // Fetch the file document based on the file ID and user ID
    const result = await fileUtils.getFile({
      _id: ObjectId(fileId),
      userId: ObjectId(userId),
    });

    // If no file is found, return Not found error
    if (!result) return response.status(404).send({ error: 'Not found' });

    // Process the file document before returning it
    const file = fileUtils.processFile(result);

    // Return the file document with a 200 status
    return response.status(200).send(file);
  }

  /**
   * Retrieves all user file documents for a specific parentId with pagination.
   * If the parentId is not linked to any user folder, returns an empty list.
   */
  static async getIndex(request, response) {
    const { userId } = await userUtils.getUserIdAndKey(request);

    // Retrieve user details
    const user = await userUtils.getUser({
      _id: ObjectId(userId),
    });

    // If user is not found, return Unauthorized error
    if (!user) return response.status(401).send({ error: 'Unauthorized' });

    // Determine the parentId from query parameters
    let parentId = request.query.parentId || '0';
    if (parentId === '0') parentId = 0;

    // Determine the page number from query parameters
    let page = Number(request.query.page) || 0;
    if (Number.isNaN(page)) page = 0;

    // Validate the parentId if it is not the root
    if (parentId !== 0 && parentId !== '0') {
      if (!basicUtils.isValidId(parentId)) {
        return response.status(401).send({ error: 'Unauthorized' });
      }

      parentId = ObjectId(parentId);
      const folder = await fileUtils.getFile({
        _id: ObjectId(parentId),
      });

      // If folder is not found or not a folder, return an empty list
      if (!folder || folder.type !== 'folder') {
        return response.status(200).send([]);
      }
    }

    // Prepare the MongoDB aggregation pipeline for pagination
    const pipeline = [
      { $match: { parentId } },
      { $skip: page * 20 },
      { $limit: 20 },
    ];

    // Fetch files for the given parentId using the aggregation pipeline
    const fileCursor = await fileUtils.getFilesOfParentId(pipeline);

    const fileList = [];
    await fileCursor.forEach((doc) => {
      const document = fileUtils.processFile(doc);
      fileList.push(document);
    });

    // Return the list of files with a 200 status
    return response.status(200).send(fileList);
  }

  /**
   * Sets the file document's isPublic property to true.
   * Ensures the user is authenticated and authorized to update the file.
   */
  static async putPublish(request, response) {
    const { error, code, updatedFile } = await fileUtils.publishUnpublish(
      request,
      true,
    );

    // Handle any errors during the publishing process
    if (error) return response.status(code).send({ error });

    // Return the updated file document with a 200 status
    return response.status(code).send(updatedFile);
  }

  /**
   * Sets the file document's isPublic property to false.
   * Ensures the user is authenticated and authorized to update the file.
   */
  static async putUnpublish(request, response) {
    const { error, code, updatedFile } = await fileUtils.publishUnpublish(
      request,
      false,
    );

    // Handle any errors during the unpublishing process
    if (error) return response.status(code).send({ error });

    // Return the updated file document with a 200 status
    return response.status(code).send(updatedFile);
  }

  /**
   * Returns the content of the file document based on the ID.
   * Checks if the file is accessible based on ownership and public status.
   */
  static async getFile(request, response) {
    const { userId } = await userUtils.getUserIdAndKey(request);
    const { id: fileId } = request.params;
    const size = request.query.size || 0;

    // Validate the fileId
    if (!basicUtils.isValidId(fileId)) {
      return response.status(404).send({ error: 'Not found' });
    }

    // Fetch the file document based on the file ID
    const file = await fileUtils.getFile({
      _id: ObjectId(fileId),
    });

    // Check if the file is accessible to the user
    if (!file || !fileUtils.isOwnerAndPublic(file, userId)) {
      return response.status(404).send({ error: 'Not found' });
    }

    // If the file is a folder, return an error
    if (file.type === 'folder') {
      return response.status(400).send({ error: "A folder doesn't have content" });
    }

    // Retrieve the file data based on the requested size
    const { error, code, data } = await fileUtils.getFileData(file, size);

    // Handle any errors during file data retrieval
    if (error) return response.status(code).send({ error });

    // Get the MIME type for the file
    const mimeType = mime.contentType(file.name);

    // Set the response content type
    response.setHeader('Content-Type', mimeType);

    // Return the file data with a 200 status
    return response.status(200).send(data);
  }
}

export default FilesController;
