import { expect, use, should } from 'chai';
import chaiHttp from 'chai-http';
import { promisify } from 'util';
import dbClient from '../utils/db';
import redisClient from '../utils/redis';

use(chaiHttp);
should();

// Testing Redis and MongoDB clients
describe('testing the clients for MongoDB and Redis', () => {
  // Redis Client Tests
  describe('redis Client', () => {
    // Before each test, flush all keys in the Redis database
    before(async () => {
      await redisClient.client.flushall('ASYNC');
    });

    // After each test, ensure Redis is clear of keys
    after(async () => {
      await redisClient.client.flushall('ASYNC');
    });

    // Check if the Redis connection is alive
    it('shows that connection is alive', async () => {
      expect(redisClient.isAlive()).to.equal(true);
    });

    // Ensure that a non-existent key returns null
    it('returns key as null because it does not exist', async () => {
      expect(await redisClient.get('myKey')).to.equal(null);
    });

    // Test setting a key with a value and expiration time
    it('set key can be called without issue', async () => {
      expect(await redisClient.set('myKey', 12, 1)).to.equal(undefined);
    });

    // After 1.1 seconds, the key should have expired and return null
    it('returns key with null because it expired', async () => {
      const sleep = promisify(setTimeout);
      await sleep(1100); // Wait for 1100 ms to check expiry
      expect(await redisClient.get('myKey')).to.equal(null);
    });
  });

  // MongoDB Client Tests
  describe('db Client', () => {
    // Before each test, clear the users and files collections
    before(async () => {
      await dbClient.usersCollection.deleteMany({});
      await dbClient.filesCollection.deleteMany({});
    });

    // After each test, ensure collections are empty
    after(async () => {
      await dbClient.usersCollection.deleteMany({});
      await dbClient.filesCollection.deleteMany({});
    });

    // Check if the MongoDB connection is alive
    it('shows that connection is alive', () => {
      expect(dbClient.isAlive()).to.equal(true);
    });

    // Test to count the number of user documents in the collection
    it('shows number of user documents', async () => {
      await dbClient.usersCollection.deleteMany({});
      expect(await dbClient.nbUsers()).to.equal(0); // Should be 0 initially

      // Insert two user documents and check the count
      await dbClient.usersCollection.insertOne({ name: 'Larry' });
      await dbClient.usersCollection.insertOne({ name: 'Karla' });
      expect(await dbClient.nbUsers()).to.equal(2); // Should be 2 after insertion
    });

    // Test to count the number of file documents in the collection
    it('shows number of file documents', async () => {
      await dbClient.filesCollection.deleteMany({});
      expect(await dbClient.nbFiles()).to.equal(0); // Should be 0 initially

      // Insert two file documents and check the count
      await dbClient.filesCollection.insertOne({ name: 'FileOne' });
      await dbClient.filesCollection.insertOne({ name: 'FileTwo' });
      expect(await dbClient.nbFiles()).to.equal(2); // Should be 2 after insertion
    });
  });
});
