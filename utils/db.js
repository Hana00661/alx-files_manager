import { MongoClient } from 'mongodb';

// Set up the database connection parameters, using environment variables or defaults
const DB_HOST = process.env.DB_HOST || 'localhost'; // Database host (default: localhost)
const DB_PORT = process.env.DB_PORT || 27017; // Database port (default: 27017)
const DB_DATABASE = process.env.DB_DATABASE || 'files_manager'; // Database name (default: 'files_manager')
const url = `mongodb://${DB_HOST}:${DB_PORT}`; // MongoDB connection URL

/**
 * Class for performing operations with the MongoDB service
 */
class DBClient {
  constructor() {
    // Connect to the MongoDB server
    MongoClient.connect(url, { useUnifiedTopology: true }, (err, client) => {
      if (!err) {
        // On successful connection, log and set up database and collections
        // console.log('Connected successfully to server');
        this.db = client.db(DB_DATABASE); // Access the specified database
        this.usersCollection = this.db.collection('users'); // Access the users collection
        this.filesCollection = this.db.collection('files'); // Access the files collection
      } else {
        // Log the error message if connection fails
        console.log(err.message);
        this.db = false; // Set db to false if connection fails
      }
    });
  }

  /**
   * Checks if the connection to the MongoDB database is alive
   * @return {boolean} true if connection is alive, false if not
   */
  isAlive() {
    return Boolean(this.db); // Return true if db is a valid object, otherwise false
  }

  /**
   * Returns the number of documents in the users collection
   * @return {Promise<number>} - A promise resolving to the number of users
   */
  async nbUsers() {
    const numberOfUsers = await this.usersCollection.countDocuments();
    return numberOfUsers; // Return the number of users
  }

  /**
   * Returns the number of documents in the files collection
   * @return {Promise<number>} - A promise resolving to the number of files
   */
  async nbFiles() {
    const numberOfFiles = await this.filesCollection.countDocuments();
    return numberOfFiles; // Return the number of files
  }
}

// Create an instance of DBClient
const dbClient = new DBClient();

export default dbClient; // Export the instance for use in other modules
