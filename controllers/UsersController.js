import { ObjectId } from 'mongodb';
import userUtils from '../utils/users';
import redisClient from '../utils/redis'; // Importing Redis client

class UsersController {
  // ... existing code ...

  /**
   * Should retrieve the user based on the token used.
   * If not found, return an error Unauthorized with a status code 401.
   * Otherwise, return the user object (email and id only).
   */
  static async getMe(request, response) {
    const token = request.headers['x-token'];

    // Check if the token is provided
    if (!token) {
      return response.status(401).send({ error: 'Unauthorized' });
    }

    const redisKey = `auth_${token}`;

    // Retrieve the user ID from Redis based on the token
    const userId = await redisClient.get(redisKey);
    if (!userId) {
      return response.status(401).send({ error: 'Unauthorized' });
    }

    // Fetch the user object based on the userId
    const user = await userUtils.getUser({
      _id: ObjectId(userId),
    });

    // Return error if user not found
    if (!user) return response.status(401).send({ error: 'Unauthorized' });

    // Construct the processed user object, excluding sensitive information
    const processedUser = { id: user._id, ...user };
    delete processedUser._id; // Remove MongoDB ID
    delete processedUser.password; // Remove password from response

    // Return the processed user object with a status code 200
    return response.status(200).send(processedUser);
  }
}

export default UsersController; // Exporting the UsersController class
