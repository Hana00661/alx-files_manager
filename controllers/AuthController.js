import { v4 as uuidv4 } from 'uuid'; // Importing uuid for generating random tokens
import sha1 from 'sha1'; // Importing sha1 for password hashing
import redisClient from '../utils/redis'; // Importing Redis client
import dbClient from '../utils/db'; // Importing database client

class AuthController {
  /**
   * Signs in the user by generating a new authentication token.
   * It expects the Authorization header to be in the format:
   * Basic <Base64-encoded email:password>
   */
  static async getConnect(request, response) {
    const authHeader = request.headers.authorization;

    // Check if the Authorization header is present
    if (!authHeader || !authHeader.startsWith('Basic ')) {
      return response.status(401).send({ error: 'Unauthorized' });
    }

    // Decode the Base64 string and extract email and password
    const base64Credentials = authHeader.split(' ')[1];
    const credentials = Buffer.from(base64Credentials, 'base64').toString('utf-8');
    const [email, password] = credentials.split(':');

    // Find the user by email and check if the password matches
    const user = await dbClient.usersCollection.findOne({ email });
    if (!user || user.password !== sha1(password)) {
      return response.status(401).send({ error: 'Unauthorized' });
    }

    // Generate a random token
    const token = uuidv4();
    const redisKey = `auth_${token}`;

    // Store the user ID in Redis for 24 hours
    await redisClient.set(redisKey, user._id.toString(), 'EX', 86400); // 86400 seconds = 24 hours

    // Return the generated token
    return response.status(200).send({ token });
  }

  /**
   * Signs out the user by deleting the authentication token.
   */
  static async getDisconnect(request, response) {
    const token = request.headers['x-token'];

    // Check if the token is provided
    if (!token) {
      return response.status(401).send({ error: 'Unauthorized' });
    }

    const redisKey = `auth_${token}`;

    // Retrieve the user ID based on the token
    const userId = await redisClient.get(redisKey);
    if (!userId) {
      return response.status(401).send({ error: 'Unauthorized' });
    }

    // Delete the token in Redis
    await redisClient.del(redisKey);

    // Return a 204 No Content response
    return response.status(204).send();
  }
}

export default AuthController; // Exporting the AuthController class
