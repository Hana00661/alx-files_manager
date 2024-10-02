import redisClient from '../utils/redis';
import dbClient from '../utils/db';

class AppController {
  /**
   * Returns the status of Redis and the database.
   * This method checks if both Redis and the database are alive
   * by using the corresponding utility functions.
   * Responds with a JSON object containing the status of each service:
   * { "redis": true, "db": true }
   * with a status code of 200.
   */
  static getStatus(request, response) {
    // Create a status object by checking if Redis and DB are alive
    const status = {
      redis: redisClient.isAlive(), // Check Redis status
      db: dbClient.isAlive(), // Check DB status
    };
    // Send the status object as a response with a 200 status code
    response.status(200).send(status);
  }

  /**
   * Retrieves the number of users and files in the database.
   * This method calls the corresponding utility functions to get
   * the count of users and files.
   * Responds with a JSON object containing the counts:
   * { "users": 12, "files": 1231 }
   * with a status code of 200.
   */
  static async getStats(request, response) {
    // Create a stats object with the number of users and files
    const stats = {
      users: await dbClient.nbUsers(), // Get the number of users
      files: await dbClient.nbFiles(), // Get the number of files
    };
    // Send the stats object as a response with a 200 status code
    response.status(200).send(stats);
  }
}

export default AppController;
