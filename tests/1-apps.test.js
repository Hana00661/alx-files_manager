import {
    expect, use, should, request,
  } from 'chai';
  import chaiHttp from 'chai-http';
  import app from '../server';
  import dbClient from '../utils/db';
  
  use(chaiHttp);
  should();
  
  // Constants for testing
  const userCredentials = {
    email: 'bob@dylan.com',
    password: 'toto1234!',
  };
  
  describe('testing App Status Endpoints', () => {
    // Test for app status
    describe('GET /status', () => {
      it('should return the status of redis and mongo connection', async () => {
        const response = await request(app).get('/status').send();
        expect(response.body).to.eql({ redis: true, db: true });
        expect(response.status).to.equal(200);
      });
    });
  
    // Test for app statistics
    describe('GET /stats', () => {
      before(async () => {
        await dbClient.usersCollection.deleteMany({});
        await dbClient.filesCollection.deleteMany({});
      });
  
      it('should return 0 users and 0 files when no entries exist', async () => {
        const response = await request(app).get('/stats').send();
        expect(response.body).to.eql({ users: 0, files: 0 });
        expect(response.status).to.equal(200);
      });
  
      it('should return 1 user and 2 files after adding entries', async () => {
        await dbClient.usersCollection.insertOne({ name: 'Larry' });
        await dbClient.filesCollection.insertOne({ name: 'image.png' });
        await dbClient.filesCollection.insertOne({ name: 'file.txt' });
  
        const response = await request(app).get('/stats').send();
        expect(response.body).to.eql({ users: 1, files: 2 });
        expect(response.status).to.equal(200);
      });
    });
  });
  