// DBClient class

import { MongoClient, ObjectId } from 'mongodb';

// Create the DBclient class
class DBClient {
  constructor() {
    const host = process.env.DB_HOST || 'localhost';
    const port = process.env.DB_PORT || 27017;
    const database = process.env.DB_DATABASE || 'files_manager';
    const url = `mongodb://${host}:${port}/${database}}`;
    this.client = new MongoClient(url, { useUnifiedTopology: true });
    this.status = false;
    this.connect();
  }

  // Create async connnection function, to be called in the constructor
  async connect() {
    try {
      await this.client.connect();
      this.status = true;
    } catch (error) {
      console.log('Error', error);
    }
  }

  // returns connection status
  isAlive() {
    return this.status;
  }

  // returns number of users
  async nbUsers() {
    const nbUsers = await this.client
      .db('files_manager')
      .collection('users')
      .countDocuments();
    return nbUsers;
  }

  // return number of files in the collection
  async nbFiles() {
    const nbFiles = await this.client
      .db('files_manager')
      .collection('files')
      .countDocuments();
    return nbFiles;
  }

  // Search for email in database
  async emailCheck(mail) {
    const user = await this.client
      .db('files_manager')
      .collection('users')
      .countDocuments({ email: mail });
    if (user) {
      return true;
    }
    return false;
  }

  // Add users to the database
  async addUser(email, password) {
    // console.log('bafore add');
    const status = await this.client
      .db('files_manager')
      .collection('users')
      .insertOne({ email, password });
    // console.log('after');
    return status.insertedId;
  }

  // Get user by email

  async getUser(email) {
    const user = await this.client
      .db('files_manager')
      .collection('users')
      .findOne({ email });
    return user;
  }

  // Get user by id
  async getUserById(identifier) {
    const user = await this.client
      .db('files_manager')
      .collection('users')
      .findOne({ _id: ObjectId(identifier) });
    return user;
  }

  // Add files to the database
  async addFile(userId, name, type, isPublic, parentId, absPath) {
    if (type === 'folder') {
      const status = await this.client
        .db('files_manager')
        .collection('files')
        .insertOne({
          // {userId: ObjectId(userId)},
          userId,
          name,
          type,
          isPublic,
          parentId,
        });
      return status.insertedId;
    }

    const status = await this.client
      .db('files_manager')
      .collection('files')
      .insertOne({
        userId,
        name,
        type,
        isPublic,
        parentId,
        absPath,
      });
    return status.insertedId;
  }

  // Get files by parentId
  // Returns the files in the parent folder
  async getParentFile(parentId) {
    const file = await this.client
      .db('files_manager')
      .collection('files')
      .findOne({ _id: ObjectId(parentId) });
    return file;
  }

  // Get file by id
  async getFileById(identifier) {
    const file = await this.client
      .db('files_manager')
      .collection('files')
      .findOne({ _id: ObjectId(identifier) });
    return file;
  }

  // Get files by userId and parentId with pagination using aggregate
  async getFilesByUserId(userId, page, parentId) {
    if (parentId === 0) {
      if (page > 0) {
        const files = await this.client
          .db('files_manager')
          .collection('files')
          .aggregate([
            { $match: { userId: ObjectId(userId) } },
            { $skip: page * 20 },
            { $limit: 20 },
          ])
          .toArray();
        return files;
      }
      const files = await this.client
        .db('files_manager')
        .collection('files')
        .aggregate([{ $match: { userId: ObjectId(userId) } }, { $limit: 20 }])
        .toArray();
      return files;
    }
    // Use aggregate to get the files
    if (page > 0) {
      const files = await this.client
        .db('files_manager')
        .collection('files')
        .aggregate([
          {
            $match: { userId: ObjectId(userId), parentId: ObjectId(parentId) },
          },
          { $limit: 20 },
        ])
        .toArray();
      return files;
    }
    const files = await this.client
      .db('files_manager')
      .collection('files')
      .aggregate([
        { $match: { userId: ObjectId(userId), parentId: ObjectId(parentId) } },
        { $limit: 20 },
      ])
      .toArray();
    return files;
  }

  // Publish file by id
  async publishFile(fileId) {
    const status = await this.client
      .db('files_manager')
      .collection('files')
      .updateOne({ _id: ObjectId(fileId) }, { $set: { isPublic: true } });
    return status;
  }

  // Unpublish file by id
  async unPublishFile(fileId) {
    const status = await this.client
      .db('files_manager')
      .collection('files')
      .updateOne({ _id: ObjectId(fileId) }, { $set: { isPublic: false } });
    return status;
  }

const dbClient = new DBClient();
module.exports = dbClient;
