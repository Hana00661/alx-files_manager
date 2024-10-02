import { ObjectId } from 'mongodb';
import { v4 as uuidv4 } from 'uuid';
import { promises as fsPromises } from 'fs';
import dbClient from './db';
import userUtils from './user';
import basicUtils from './basic';

/**
 * Module with file utilities
 */
const fileUtils = {
  /**
   * Validates if the request body is valid for creating a file.
   * @param {request_object} request - The Express request object.
   * @returns {object} An object containing error message (if any) and validated file parameters.
   */
  async validateBody(request) {
    const {
      name, type, isPublic = false, data,
    } = request.body;

    let { parentId = 0 } = request.body;

    const typesAllowed = ['file', 'image', 'folder'];
    let msg = null;

    // Convert parentId to number if it's a string '0'
    if (parentId === '0') parentId = 0;

    // Validate required fields and their values
    if (!name) {
      msg = 'Missing name';
    } else if (!type || !typesAllowed.includes(type)) {
      msg = 'Missing type';
    } else if (!data && type !== 'folder') {
      msg = 'Missing data';
    } else if (parentId && parentId !== '0') {
      let file;

      // Check if parentId is valid, if so fetch the parent file
      if (basicUtils.isValidId(parentId)) {
        file = await this.getFile({
          _id: ObjectId(parentId),
        });
      } else {
        file = null;
      }

      // Validate the existence and type of the parent file
      if (!file) {
        msg = 'Parent not found';
      } else if (file.type !== 'folder') {
        msg = 'Parent is not a folder';
      }
    }

    // Construct the return object with error and validated params
    const obj = {
      error: msg,
      fileParams: {
        name,
        type,
        parentId,
        isPublic,
        data,
      },
    };

    return obj;
  },

  /**
   * Gets a file document from the database.
   * @param {object} query - Query used to find the file.
   * @returns {object} The file document.
   */
  async getFile(query) {
    const file = await dbClient.filesCollection.findOne(query);
    return file;
  },

  /**
   * Gets a list of file documents from the database belonging to a parent ID.
   * @param {object} query - Query used to find files.
   * @returns {Array} List of file documents.
   */
  async getFilesOfParentId(query) {
    const fileList = await dbClient.filesCollection.aggregate(query);
    return fileList;
  },

  /**
   * Saves files to the database and disk.
   * @param {string} userId - The ID of the user saving the file.
   * @param {object} fileParams - Object containing attributes of the file to save.
   * @param {string} FOLDER_PATH - Path to save the file on disk.
   * @returns {object} Object containing error (if present) and the new file document.
   */
  async saveFile(userId, fileParams, FOLDER_PATH) {
    const {
      name, type, isPublic, data,
    } = fileParams;
    let { parentId } = fileParams;

    // Convert parentId to ObjectId if it's not zero
    if (parentId !== 0) parentId = ObjectId(parentId);

    const query = {
      userId: ObjectId(userId),
      name,
      type,
      isPublic,
      parentId,
    };

    // Handle non-folder file types
    if (fileParams.type !== 'folder') {
      const fileNameUUID = uuidv4();

      // Decode base64 data
      const fileDataDecoded = Buffer.from(data, 'base64');

      const path = `${FOLDER_PATH}/${fileNameUUID}`;

      // Set the local path in the query object
      query.localPath = path;

      try {
        // Create the folder path if it doesn't exist and write the file
        await fsPromises.mkdir(FOLDER_PATH, { recursive: true });
        await fsPromises.writeFile(path, fileDataDecoded);
      } catch (err) {
        return { error: err.message, code: 400 };
      }
    }

    // Insert the file document into the database
    const result = await dbClient.filesCollection.insertOne(query);

    // Process the file document to transform it
    const file = this.processFile(query);

    // Combine the inserted ID with the processed file
    const newFile = { id: result.insertedId, ...file };

    return { error: null, newFile };
  },

  /**
   * Updates a file document in the database.
   * @param {object} query - Query to find the document to update.
   * @param {object} set - Object containing update information for MongoDB.
   * @returns {object} The updated file document.
   */
  async updateFile(query, set) {
    const fileList = await dbClient.filesCollection.findOneAndUpdate(
      query,
      set,
      { returnOriginal: false },
    );
    return fileList;
  },

  /**
   * Makes a file public or private.
   * @param {request_object} request - The Express request object.
   * @param {boolean} setPublish - True to make public, false to make private.
   * @returns {object} Error message (if any), status code, and updated file document.
   */
  async publishUnpublish(request, setPublish) {
    const { id: fileId } = request.params;

    // Validate fileId
    if (!basicUtils.isValidId(fileId)) { return { error: 'Unauthorized', code: 401 }; }

    // Get the user ID from the request
    const { userId } = await userUtils.getUserIdAndKey(request);

    // Validate userId
    if (!basicUtils.isValidId(userId)) { return { error: 'Unauthorized', code: 401 }; }

    // Fetch the user from the database
    const user = await userUtils.getUser({
      _id: ObjectId(userId),
    });

    // If user not found, return unauthorized error
    if (!user) return { error: 'Unauthorized', code: 401 };

    // Fetch the file document to update
    const file = await this.getFile({
      _id: ObjectId(fileId),
      userId: ObjectId(userId),
    });

    // If file not found, return not found error
    if (!file) return { error: 'Not found', code: 404 };

    // Update the file's public/private status
    const result = await this.updateFile(
      {
        _id: ObjectId(fileId),
        userId: ObjectId(userId),
      },
      { $set: { isPublic: setPublish } },
    );

    const {
      _id: id,
      userId: resultUserId,
      name,
      type,
      isPublic,
      parentId,
    } = result.value;

    // Construct the updated file object
    const updatedFile = {
      id,
      userId: resultUserId,
      name,
      type,
      isPublic,
      parentId,
    };

    return { error: null, code: 200, updatedFile };
  },

  /**
   * Transforms _id into id in a file document.
   * @param {object} doc - The document to be processed.
   * @returns {object} The processed document without _id and localPath.
   */
  processFile(doc) {
    // Change _id for id and remove localPath
    const file = { id: doc._id, ...doc };

    delete file.localPath;
    delete file._id;

    return file;
  },

  /**
   * Checks if a file is public and belongs to a specific user.
   * @param {object} file - The file to evaluate.
   * @param {string} userId - The ID of the user to check ownership.
   * @returns {boolean} True if the user is the owner or the file is public, otherwise false.
   */
  isOwnerAndPublic(file, userId) {
    // Return false if the file is not public and userId is invalid
    if (
      (!file.isPublic && !userId)
      || (userId && file.userId.toString() !== userId && !file.isPublic)
    ) { return false; }

    return true;
  },

  /**
   * Gets a file's data from the database.
   * @param {object} file - The file to obtain data from.
   * @param {string} size - Size suffix for image files (optional).
   * @returns {object} Object containing file data or error and status code.
   */
  async getFileData(file, size) {
    let { localPath } = file;
    let data;

    // Append size suffix to the local path if provided
    if (size) localPath = `${localPath}_${size}`;

    try {
      // Read the file from the local path
      data = await fsPromises.readFile(localPath);
    } catch (err) {
      return { error: 'Not found', code: 404 }; // Return not found error if file reading fails
    }

    return { data }; // Return the file data
  },
};

// Export the fileUtils module
export default fileUtils;
