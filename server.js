import express from 'express'; // Importing the express framework
import controllerRouting from './routes/index'; // Importing routing configurations from the routes module

const app = express(); // Creating an Express application instance
const port = process.env.PORT || 5000; // Setting the port to the value from environment variables or defaulting to 5000

app.use(express.json()); // Middleware to parse incoming JSON requests

controllerRouting(app); // Setting up the routes using the imported routing configurations

// Starting the server and listening on the specified port
app.listen(port, () => {
  console.log(`Server running on port ${port}`); // Logging the server's running status
});

export default app; // Exporting the app instance for potential use in other modules (e.g., testing)
