import express from 'express';
import AppController from '../controllers/AppController';
import UsersController from '../controllers/UsersController';
import AuthController from '../controllers/AuthController';
import FilesController from '../controllers/FilesController';

function controllerRouting(app) {
  const router = express.Router();
  app.use('/', router);

  // App Controller
  // Endpoint to check the status of Redis and the database
  router.get('/status', (req, res) => {
    AppController.getStatus(req, res);
  });

  // Endpoint to retrieve the number of users and files in the database
  router.get('/stats', (req, res) => {
    AppController.getStats(req, res);
  });

  // User Controller
  // Endpoint to create a new user in the database
  router.post('/users', (req, res) => {
    UsersController.postNew(req, res);
  });

  // Endpoint to retrieve the authenticated user's information based on the token used
  router.get('/users/me', (req, res) => {
    UsersController.getMe(req, res);
  });

  // Auth Controller
  // Endpoint to sign in the user by generating a new authentication token
  router.get('/connect', (req, res) => {
    AuthController.getConnect(req, res);
  });

  // Endpoint to sign out the user based on the token
  router.get('/disconnect', (req, res) => {
    AuthController.getDisconnect(req, res);
  });

  // Files Controller
  // Endpoint to create a new file in the database and save it on disk
  router.post('/files', (req, res) => {
    FilesController.postUpload(req, res);
  });

  // Endpoint to retrieve a file document based on the provided ID
  router.get('/files/:id', (req, res) => {
    FilesController.getShow(req, res);
  });

  // Endpoint to retrieve all user file documents for a specific parentId with pagination
  router.get('/files', (req, res) => {
    FilesController.getIndex(req, res);
  });

  // Endpoint to publish a file by setting isPublic to true based on the ID
  router.put('/files/:id/publish', (req, res) => {
    FilesController.putPublish(req, res);
  });

  // Endpoint to unpublish a file by setting isPublic to false based on the ID
  router.put('/files/:id/unpublish', (req, res) => {
    FilesController.putUnpublish(req, res);
  });

  // Endpoint to return the content of the file document based on the ID
  router.get('/files/:id/data', (req, res) => {
    FilesController.getFile(req, res);
  });
}

export default controllerRouting;
