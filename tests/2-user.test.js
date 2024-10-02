import {
    expect, use, should, request,
  } from 'chai'; // Importing assertion libraries for testing
  import chaiHttp from 'chai-http'; // Importing chai-http for making HTTP requests
  import sinon from 'sinon'; // Importing sinon for spying and mocking
  import { ObjectId } from 'mongodb'; // Importing ObjectId to work with MongoDB ObjectIds
  import app from '../server'; // Importing the application instance
  import dbClient from '../utils/db'; // Importing database client utilities
  import redisClient from '../utils/redis'; // Importing Redis client utilities
  
  use(chaiHttp); // Activating chai-http
  should(); // Enabling should-style assertions
  
  // User Endpoints ==============================================
  
  describe('testing User Endpoints', () => {
    // Base64 encoded credentials for authentication
    const credentials = 'Basic Ym9iQGR5bGFuLmNvbTp0b3RvMTIzNCE=';
    let token = ''; // Variable to store the authentication token
    let userId = ''; // Variable to store the created user's ID
    const user = {
      email: 'bob@dylan.com', // Test user email
      password: 'toto1234!', // Test user password
    };
  
    // Clean up before starting tests
    before(async () => {
      await redisClient.client.flushall('ASYNC'); // Clear Redis database
      await dbClient.usersCollection.deleteMany({}); // Clear users collection in MongoDB
      await dbClient.filesCollection.deleteMany({}); // Clear files collection in MongoDB
    });
  
    // Clean up after all tests
    after(async () => {
      await redisClient.client.flushall('ASYNC'); // Clear Redis database
      await dbClient.usersCollection.deleteMany({}); // Clear users collection in MongoDB
      await dbClient.filesCollection.deleteMany({}); // Clear files collection in MongoDB
    });
  
    // User registration tests
    describe('pOST /users', () => {
      it('returns the id and email of created user', async () => {
        // Test creating a new user
        const response = await request(app).post('/users').send(user);
        const body = JSON.parse(response.text);
        expect(body.email).to.equal(user.email); // Check that the email matches
        expect(body).to.have.property('id'); // Check that an ID is returned
        expect(response.statusCode).to.equal(201); // Check for HTTP status 201 (Created)
  
        userId = body.id; // Store the user ID for later tests
        const userMongo = await dbClient.usersCollection.findOne({
          _id: ObjectId(body.id), // Retrieve user from MongoDB
        });
        expect(userMongo).to.exist; // Check that the user exists in the database
      });
  
      it('fails to create user because password is missing', async () => {
        // Test missing password during user creation
        const user = {
          email: 'bob@dylan.com', // Only providing email
        };
        const response = await request(app).post('/users').send(user);
        const body = JSON.parse(response.text);
        expect(body).to.eql({ error: 'Missing password' }); // Check for the correct error message
        expect(response.statusCode).to.equal(400); // Check for HTTP status 400 (Bad Request)
      });
  
      it('fails to create user because email is missing', async () => {
        // Test missing email during user creation
        const user = {
          password: 'toto1234!', // Only providing password
        };
        const response = await request(app).post('/users').send(user);
        const body = JSON.parse(response.text);
        expect(body).to.eql({ error: 'Missing email' }); // Check for the correct error message
        expect(response.statusCode).to.equal(400); // Check for HTTP status 400 (Bad Request)
      });
  
      it('fails to create user because it already exists', async () => {
        // Test trying to create an already existing user
        const user = {
          email: 'bob@dylan.com', // Same email as before
          password: 'toto1234!',
        };
        const response = await request(app).post('/users').send(user);
        const body = JSON.parse(response.text);
        expect(body).to.eql({ error: 'Already exist' }); // Check for the correct error message
        expect(response.statusCode).to.equal(400); // Check for HTTP status 400 (Bad Request)
      });
    });
  
    // Connect tests
    describe('gET /connect', () => {
      it('fails if no user is found for credentials', async () => {
        // Test authentication failure with incorrect credentials
        const response = await request(app).get('/connect').send();
        const body = JSON.parse(response.text);
        expect(body).to.eql({ error: 'Unauthorized' }); // Check for the correct error message
        expect(response.statusCode).to.equal(401); // Check for HTTP status 401 (Unauthorized)
      });
  
      it('returns a token if user is for credentials', async () => {
        // Test successful authentication
        const spyRedisSet = sinon.spy(redisClient, 'set'); // Spy on the redisClient.set function
  
        const response = await request(app)
          .get('/connect')
          .set('Authorization', credentials) // Setting authorization header
          .send();
        const body = JSON.parse(response.text);
        token = body.token; // Store the token for later tests
        expect(body).to.have.property('token'); // Check that a token is returned
        expect(response.statusCode).to.equal(200); // Check for HTTP status 200 (OK)
        expect(
          spyRedisSet.calledOnceWithExactly(`auth_${token}`, userId, 24 * 3600),
        ).to.be.true; // Verify that the token is stored in Redis with the correct parameters
  
        spyRedisSet.restore(); // Restore the original function
      });
  
      it('token exists in redis', async () => {
        // Test that the token is stored in Redis
        const redisToken = await redisClient.get(`auth_${token}`);
        expect(redisToken).to.exist; // Check that the token exists in Redis
      });
    });
  
    // Disconnect tests
    describe('gET /disconnect', () => {
      after(async () => {
        await redisClient.client.flushall('ASYNC'); // Clear Redis database after tests
      });
  
      it('should responde with unauthorized because there is no token for user', async () => {
        // Test disconnection without a token
        const response = await request(app).get('/disconnect').send();
        const body = JSON.parse(response.text);
        expect(body).to.eql({ error: 'Unauthorized' }); // Check for the correct error message
        expect(response.statusCode).to.equal(401); // Check for HTTP status 401 (Unauthorized)
      });
  
      it('should sign-out the user based on the token', async () => {
        // Test signing out a user with a valid token
        const response = await request(app)
          .get('/disconnect')
          .set('X-Token', token) // Setting the token in the request header
          .send();
        expect(response.text).to.be.equal(''); // Check that the response body is empty
        expect(response.statusCode).to.equal(204); // Check for HTTP status 204 (No Content)
      });
  
      it('token no longer exists in redis', async () => {
        // Test that the token is removed from Redis after disconnect
        const redisToken = await redisClient.get(`auth_${token}`);
        expect(redisToken).to.not.exist; // Check that the token no longer exists in Redis
      });
    });
  
    // Get current user tests
    describe('gET /users/me', () => {
      before(async () => {
        // Authenticate before testing current user retrieval
        const response = await request(app)
          .get('/connect')
          .set('Authorization', credentials)
          .send();
        const body = JSON.parse(response.text);
        token = body.token; // Store the token for later tests
      });
  
      it('should return unauthorized because no token is passed', async () => {
        // Test retrieving user information without a token
        const response = await request(app).get('/users/me').send();
        const body = JSON.parse(response.text);
  
        expect(body).to.be.eql({ error: 'Unauthorized' }); // Check for the correct error message
        expect(response.statusCode).to.equal(401); // Check for HTTP status 401 (Unauthorized)
      });
  
      it('should retrieve the user based on the token used', async () => {
        // Test retrieving user information with a valid token
        const response = await request(app)
          .get('/users/me')
          .set('X-Token', token) // Setting the token in the request header
          .send();
        const body = JSON.parse(response.text);
  
        expect(body).to.be.eql({ id: userId, email: user.email }); // Check that the retrieved user matches the expected values
        expect(response.statusCode).to.equal(200); // Check for HTTP status 200 (OK)
      });
    });
  });
  