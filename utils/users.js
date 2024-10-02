import redisClient from './redis';
import dbClient from './db';

/**
 * Module with user utilities
 */
const userUtils = {
  /**
   * Gets the user ID and Redis key from the request
   * @param {object} request - Express request object
   * @return {object} - An object containing userId and Redis key for token
   */
  async getUserIdAndKey(request) {
    const obj = { userId: null, key: null }; // Initialize object to hold userId and Redis key

    const xToken = request.header('X-Token'); // Extract X-Token from request headers

    // If X-Token is not provided, return the empty object
    if (!xToken) return obj;

    // Construct the Redis key using the token
    obj.key = `auth_${xToken}`;

    // Fetch the userId from Redis using the constructed key
    obj.userId = await redisClient.get(obj.key);

    return obj; // Return the object containing userId and key
  },

  /**
   * Gets a user from the database
   * @param {object} query - Query expression for finding the user
   * @return {object} - User document object
   */
  async getUser(query) {
    // Retrieve the user document from the usersCollection based on the provided query
    const user = await dbClient.usersCollection.findOne(query);
    return user; // Return the found user document
  },
};

// Export the userUtils module for use in other parts of the application
export default userUtils;
