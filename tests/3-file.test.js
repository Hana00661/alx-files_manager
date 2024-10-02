import {
    expect, use, should, request,
  } from 'chai';
  import chaiHttp from 'chai-http';
  import sinon from 'sinon';
  import { ObjectId } from 'mongodb';
  import app from '../server';
  import dbClient from '../utils/db';
  import redisClient from '../utils/redis';
  
  // Set up Chai to use the HTTP plugin for making requests
  use(chaiHttp);
  should();
  
  // User Endpoints ==============================================
  
  describe('testing User Endpoints', () => {
    // Base64-encoded credentials for authorization
    const credentials = 'Basic Ym9iQGR5bGFuLmNvbTp0b3RvMTIzNCE=';
    let token = ''; // Variable to hold the user token
    let userId = ''; // Variable to hold the user ID
    const user = {
      email: 'bob@dylan.com', // Sample user email
      password: 'toto1234!', // Sample user password
    };
  
    // Setup before running tests
    before(async () => {
      // Flush all Redis data
      await redisClient.client.flushall('ASYNC');
      // Clear user and file collections in the database
      await dbClient.usersCollection.deleteMany({});
      await dbClient.filesCollection.deleteMany({});
    });
  
    // Cleanup after tests
    after(async () => {
      // Flush Redis data again
      await redisClient.client.flushall('ASYNC');
      // Clear user and file collections in the database
      await dbClient.usersCollection.deleteMany({});
      await dbClient.filesCollection.deleteMany({});
    });
  
    // Test case for user registration
    describe('pOST /users', () => {
      it('returns the id and email of created user', async () => {
        // Send a POST request to create a user
        const response = await request(app).post('/users').send(user);
        const body = JSON.parse(response.text); // Parse the response body
  
        // Check that the response contains the expected user email and ID
        expect(body.email).to.equal(user.email);
        expect(body).to.have.property('id');
        expect(response.statusCode).to.equal(201);
  
        userId = body.id; // Store the newly created user ID
  
        // Verify that the user was saved in the MongoDB collection
        const userMongo = await dbClient.usersCollection.findOne({
          _id: ObjectId(body.id),
        });
        expect(userMongo).to.exist; // Ensure the user exists in the database
      });
  
      it('fails to create user because password is missing', async () => {
        const user = {
          email: 'bob@dylan.com', // Missing password
        };
        const response = await request(app).post('/users').send(user);
        const body = JSON.parse(response.text);
        // Expect error response for missing password
        expect(body).to.eql({ error: 'Missing password' });
        expect(response.statusCode).to.equal(400);
      });
  
      it('fails to create user because email is missing', async () => {
        const user = {
          password: 'toto1234!', // Missing email
        };
        const response = await request(app).post('/users').send(user);
        const body = JSON.parse(response.text);
        // Expect error response for missing email
        expect(body).to.eql({ error: 'Missing email' });
        expect(response.statusCode).to.equal(400);
      });
  
      it('fails to create user because it already exists', async () => {
        const user = {
          email: 'bob@dylan.com', // Same email as the existing user
          password: 'toto1234!',
        };
        const response = await request(app).post('/users').send(user);
        const body = JSON.parse(response.text);
        // Expect error response for already existing user
        expect(body).to.eql({ error: 'Already exist' });
        expect(response.statusCode).to.equal(400);
      });
    });
  
    // Connect endpoint tests
  
    describe('gET /connect', () => {
      it('fails if no user is found for credentials', async () => {
        // Attempt to connect without credentials
        const response = await request(app).get('/connect').send();
        const body = JSON.parse(response.text);
        // Expect unauthorized response
        expect(body).to.eql({ error: 'Unauthorized' });
        expect(response.statusCode).to.equal(401);
      });
  
      it('returns a token if user is for credentials', async () => {
        // Spy on redisClient.set to verify it is called correctly
        const spyRedisSet = sinon.spy(redisClient, 'set');
  
        // Attempt to connect with valid credentials
        const response = await request(app)
          .get('/connect')
          .set('Authorization', credentials)
          .send();
        const body = JSON.parse(response.text);
        token = body.token; // Store the generated token
  
        // Verify that the token is included in the response
        expect(body).to.have.property('token');
        expect(response.statusCode).to.equal(200);
        // Verify that the token is stored in Redis with a TTL of 24 hours
        expect(
          spyRedisSet.calledOnceWithExactly(`auth_${token}`, userId, 24 * 3600),
        ).to.be.true;
  
        spyRedisSet.restore(); // Restore the original spy
      });
  
      it('token exists in redis', async () => {
        // Check if the token is stored in Redis
        const redisToken = await redisClient.get(`auth_${token}`);
        expect(redisToken).to.exist; // Ensure the token exists
      });
    });
  
    // Disconnect endpoint tests
  
    describe('gET /disconnect', () => {
      after(async () => {
        // Clean Redis after tests
        await redisClient.client.flushall('ASYNC');
      });
  
      it('should responde with unauthorized because there is no token for user', async () => {
        // Attempt to disconnect without a token
        const response = await request(app).get('/disconnect').send();
        const body = JSON.parse(response.text);
        // Expect unauthorized response
        expect(body).to.eql({ error: 'Unauthorized' });
        expect(response.statusCode).to.equal(401);
      });
  
      it('should sign-out the user based on the token', async () => {
        // Attempt to disconnect with the token
        const response = await request(app)
          .get('/disconnect')
          .set('X-Token', token)
          .send();
        expect(response.text).to.be.equal(''); // Expect empty response
        expect(response.statusCode).to.equal(204); // Expect No Content status
      });
  
      it('token no longer exists in redis', async () => {
        // Check if the token has been removed from Redis
        const redisToken = await redisClient.get(`auth_${token}`);
        expect(redisToken).to.not.exist; // Ensure the token does not exist
      });
    });
  
    // Retrieve current user info
  
    describe('gET /users/me', () => {
      before(async () => {
        // Connect the user to get a valid token
        const response = await request(app)
          .get('/connect')
          .set('Authorization', credentials)
          .send();
        const body = JSON.parse(response.text);
        token = body.token; // Store the token for subsequent requests
      });
  
      it('should return unauthorized because no token is passed', async () => {
        // Attempt to get user info without a token
        const response = await request(app).get('/users/me').send();
        const body = JSON.parse(response.text);
        // Expect unauthorized response
        expect(body).to.be.eql({ error: 'Unauthorized' });
        expect(response.statusCode).to.equal(401);
      });
  
      it('should retrieve the user based on the token used', async () => {
        // Attempt to get user info with the valid token
        const response = await request(app)
          .get('/users/me')
          .set('X-Token', token)
          .send();
        const body = JSON.parse(response.text);
        // Expect response to contain the user ID and email
        expect(body).to.be.eql({ id: userId, email: user.email });
        expect(response.statusCode).to.equal(200);
      });
    });
  });
  