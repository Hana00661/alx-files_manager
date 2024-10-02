import { ObjectId } from 'mongodb';

/**
 * Module with basic utilities for MongoDB operations.
 */
const basicUtils = {
  /**
   * Checks if the provided ID is valid for MongoDB.
   * @param {string|number} id - The ID to be evaluated.
   * @return {boolean} - Returns true if the ID is valid, false if it is not.
   */
  isValidId(id) {
    try {
      // Attempt to create a new ObjectId instance from the given ID.
      ObjectId(id);
    } catch (err) {
      // If an error is thrown, the ID is not valid.
      return false;
    }
    // If no error was thrown, the ID is valid.
    return true;
  },
};

export default basicUtils;
