import redisClient from './redis';
import dbClient from './db';

/**
 * Module with user utilities
 */
const userUtils = {
  /**
   * Gets a user ID and Redis key for the token from the request.
   * @param {request_object} request - The Express request object.
   * @returns {object} An object containing userId and Redis key for the token.
   */
  async getUserIdAndKey(request) {
    // Initialize an object to hold userId and key.
    const obj = { userId: null, key: null };

    // Retrieve the token from the request header.
    const xToken = request.header('X-Token');

    // If no token is provided, return the object with null values.
    if (!xToken) return obj;

    // Set the Redis key using the token.
    obj.key = `auth_${xToken}`;

    // Retrieve the userId from Redis using the generated key.
    obj.userId = await redisClient.get(obj.key);

    // Return the object containing userId and Redis key.
    return obj;
  },

  /**
   * Gets a user from the database based on the provided query.
   * @param {object} query - Query expression for finding the user.
   * @returns {object} The user document object retrieved from the database.
   */
  async getUser(query) {
    // Find a user in the database using the provided query.
    const user = await dbClient.usersCollection.findOne(query);
    
    // Return the user document object.
    return user;
  },
};

// Export the userUtils module for use in other parts of the application.
export default userUtils;
