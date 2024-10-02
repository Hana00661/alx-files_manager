import express from 'express';
import AppController from '../controllers/AppController';
import UsersController from '../controllers/UsersController';
import AuthController from '../controllers/AuthController';
import FilesController from '../controllers/FilesController';

function controllerRouting(app) {
  const router = express.Router(); // Create a new router
  app.use('/', router); // Use the router for all incoming requests

  // App Controller

  // Route to check if Redis and the database are alive
  router.get('/status', (req, res) => {
    AppController.getStatus(req, res);
  });

  // Route to retrieve the number of users and files in the database
  router.get('/stats', (req, res) => {
    AppController.getStats(req, res);
  });

  // User Controller

  // Route to create a new user in the database
  router.post('/users', (req, res) => {
    UsersController.postNew(req, res);
  });

  // Route to retrieve the current user based on the authentication token
  router.get('/users/me', (req, res) => {
    UsersController.getMe(req, res);
  });

  // Auth Controller

  // Route to sign-in the user and generate a new authentication token
  router.get('/connect', (req, res) => {
    AuthController.getConnect(req, res);
  });

  // Route to sign-out the user based on the provided token
  router.get('/disconnect', (req, res) => {
    AuthController.getDisconnect(req, res);
  });

  // Files Controller

  // Route to upload a new file, storing it in the database and on disk
  router.post('/files', (req, res) => {
    FilesController.postUpload(req, res);
  });

  // Route to retrieve a specific file document by its ID
  router.get('/files/:id', (req, res) => {
    FilesController.getShow(req, res);
  });

  // Route to retrieve all files for a specific parentId with pagination
  router.get('/files', (req, res) => {
    FilesController.getIndex(req, res);
  });

  // Route to publish a file, setting its isPublic status to true
  router.put('/files/:id/publish', (req, res) => {
    FilesController.putPublish(req, res);
  });

  // Route to unpublish a file, setting its isPublic status to false
  router.put('/files/:id/unpublish', (req, res) => {
    FilesController.putUnpublish(req, res);
  });

  // Route to return the content of a file document based on its ID
  router.get('/files/:id/data', (req, res) => {
    FilesController.getFile(req, res);
  });
}

export default controllerRouting;
