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
   * Validates the request body for file operations
   * @param {Object} request - The request object containing body parameters
   * @returns {Object} - An object containing an error message (if any) and file parameters
   */
  async validateBody(request) {
    const {
      name, type, isPublic = false, data,
    } = request.body; // Destructure required fields from request body
    let { parentId = 0 } = request.body; // Default parentId to 0 if not provided

    if (parentId === '0') parentId = 0; // Convert string '0' to number 0

    let msg = null; // Initialize error message variable

    // Validate the request parameters
    if (!name) {
      msg = 'Missing name'; // Check if name is provided
    } else if (!type || !['file', 'image', 'folder'].includes(type)) {
      msg = 'Missing type'; // Check if type is valid
    } else if (!data && type !== 'folder') {
      msg = 'Missing data'; // Check if data is provided for non-folder types
    } else if (parentId && parentId !== '0') {
      const file = basicUtils.isValidId(parentId) ? await this.getFile({ _id: ObjectId(parentId) }) : null;

      if (!file) {
        msg = 'Parent not found'; // Check if parent file exists
      } else if (file.type !== 'folder') {
        msg = 'Parent is not a folder'; // Check if the parent is a folder
      }
    }

    // Return the validation result
    return {
      error: msg,
      fileParams: {
        name, type, parentId, isPublic, data,
      },
    };
  },

  // Other file utility methods (e.g., create, read, update, delete) should be defined here...
};

export default fileUtils;
