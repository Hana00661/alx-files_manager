import sha1 from 'sha1';
import { v4 as uuidv4 } from 'uuid';
import dbClient from '../utils/db';
import redisClient from '../utils/redis';

class AuthController {
  /**
   * getConnect - Handles user authentication (login).
   * 
   * It validates the 'Authorization' header, checks the email and hashed password 
   * in the database, and if the user is found, it generates a token, stores the user ID
   * in Redis with a 24-hour expiration, and returns the token.
   */
  static async getConnect(request, response) {
    // Extract 'Authorization' header from the request
    const authHeader = request.header('Authorization');
    
    // If the 'Authorization' header is missing, return nothing
    if (!authHeader) {
      return;
    }

    // Validate the format of the 'Authorization' header (should be a string)
    if (typeof (authHeader) !== 'string') {
      return;
    }

    // Ensure the header starts with 'Basic '
    if (authHeader.slice(0, 6) !== 'Basic ') {
      return;
    }

    // Extract the Base64-encoded part of the 'Authorization' header
    const authHeaderDetails = authHeader.slice(6);
    const decodedDetails = Buffer.from(authHeaderDetails, 'base64').toString('utf8');
    
    // Split the decoded string to extract email and password
    const data = decodedDetails.split(':');
    
    // If the email or password is missing, return an error
    if (data.length !== 2) {
      response.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Hash the provided password using SHA1
    const hashedPassword = sha1(data[1]);

    // Search for the user in the database by email and hashed password
    const users = dbClient.db.collection('users');
    const desiredUser = await users.findOne({ email: data[0], password: hashedPassword });

    // If a user is found, generate a UUID token and store it in Redis with a 24-hour expiry
    if (desiredUser) {
      const token = uuidv4();  // Generate a unique token
      const key = `auth_${token}`;  // Create Redis key using the token

      // Store the user ID in Redis for 24 hours (86400 seconds)
      await redisClient.set(key, desiredUser._id.toString(), 862400);

      // Respond with the generated token
      response.status(200).json({ token });
    } else {
      // If authentication fails, return a 401 Unauthorized response
      response.status(401).json({ error: 'Unauthorized' });
    }
  }

  /**
   * getDisconnect - Handles user logout.
   * 
   * It retrieves the token from the 'X-Token' header, verifies if it exists in Redis,
   * deletes the token, and responds with a 204 No Content status.
   */
  static async getDisconnect(request, response) {
    // Extract the token from the 'X-Token' header
    const token = request.header('X-Token');
    const key = `auth_${token}`;  // Create Redis key using the token
    
    // Retrieve the user ID associated with the token from Redis
    const id = await redisClient.get(key);

    // If the token exists in Redis, delete it and respond with a 204 status
    if (id) {
      await redisClient.del(key);  // Delete the token from Redis
      response.status(204).json({});
    } else {
      // If the token is not found, respond with a 401 Unauthorized error
      response.status(401).json({ error: 'Unauthorized' });
    }
  }
}

// Export the AuthController class for use in other parts of the application
module.exports = AuthController;
