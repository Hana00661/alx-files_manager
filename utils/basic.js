import { ObjectId } from 'mongodb';

/**
 * Module with basic utilities
 */
const basicUtils = {
  /**
   * Checks if an ID is valid for MongoDB.
   * @param {string|number} id - The ID to be evaluated.
   * @returns {boolean} true if valid, false if not.
   */
  isValidId(id) {
    try {
      ObjectId(id); // Attempt to convert the ID to an ObjectId
    } catch (err) {
      return false; // If an error occurs, the ID is not valid
    }
    return true; // If no error, the ID is valid
  },
};

// Export the basicUtils module
export default basicUtils;
