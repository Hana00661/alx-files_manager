import redis from 'redis';
import { promisify } from 'util';

/**
 * Class for performing operations with Redis service
 */
class RedisClient {
  constructor() {
    // Create a new Redis client
    this.client = redis.createClient();
    // Promisify the get method for easier async/await usage
    this.getAsync = promisify(this.client.get).bind(this.client);

    // Handle errors on the Redis client
    this.client.on('error', (error) => {
      console.log(`Redis client not connected to the server: ${error.message}`);
    });
  }

  /**
   * Checks if the connection to Redis is alive
   * @return {boolean} - true if the connection is alive, false otherwise
   */
  isAlive() {
    return this.client.connected; // Return the connection status
  }

  /**
   * Gets the value corresponding to the key in Redis
   * @param {string} key - The key to search for in Redis
   * @return {string} - The value of the key
   */
  async get(key) {
    const value = await this.getAsync(key); // Retrieve value from Redis
    return value; // Return the retrieved value
  }

  /**
   * Creates a new key in Redis with a specific TTL (time-to-live)
   * @param {string} key - The key to be saved in Redis
   * @param {string} value - The value to be assigned to the key
   * @param {number} duration - TTL of the key in seconds
   * @return {undefined} - No return value
   */
  async set(key, value, duration) {
    this.client.setex(key, duration, value); // Set the key with expiration
  }

  /**
   * Deletes a key in the Redis service
   * @param {string} key - The key to be deleted
   * @return {undefined} - No return value
   */
  async del(key) {
    this.client.del(key); // Delete the key from Redis
  }
}

// Create an instance of RedisClient
const redisClient = new RedisClient();

export default redisClient; // Export the Redis client instance
