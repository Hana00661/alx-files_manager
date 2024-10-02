// Importing the dbClient and redisClient utilities
import dbClient from '../utils/db';
import redisClient from '../utils/redis';

class AppController {
  /**
   * getStatus - A static method to get the current status of Redis and the database.
   * It checks if Redis and the database are alive and sends a response with their status.
   * 
   * @param {Object} request - The incoming HTTP request object (not used in this method).
   * @param {Object} response - The HTTP response object to send back the status.
   */
  static getStatus(request, response) {
    // Check if Redis is alive (connected and working)
    const redisstatus = redisClient.isAlive();
    // Check if the database is alive (connected and working)
    const dbstatus = dbClient.isAlive();
    
    // Send a response with the Redis and database statuses
    response.status(200).send({ redis: redisstatus, db: dbstatus });
  }

  /**
   * getStats - A static method to get statistics on the number of users and files.
   * It fetches the total number of users and files from the database asynchronously and sends the data as a response.
   * 
   * @param {Object} request - The incoming HTTP request object (not used in this method).
   * @param {Object} response - The HTTP response object to send back the statistics.
   */
  static async getStats(request, response) {
    try {
      // Asynchronously get the number of user documents from the database
      const userdocumentsnum = await dbClient.nbUsers();
      // Asynchronously get the number of file documents from the database
      const filesdocumentsnum = await dbClient.nbFiles();
      
      // Send a response with the total number of users and files
      response.status(200).send({ users: userdocumentsnum, files: filesdocumentsnum });
    } catch (error) {
      // Handle potential errors by sending a 500 status and error message
      response.status(500).send({ error: 'An error occurred while fetching statistics' });
    }
  }
}

// Exporting the AppController class to make it available for other modules
module.exports = AppController;
