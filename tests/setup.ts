/**
 * `dbConnect` throws at import time when MONGODB_URI is missing, and some
 * modules under test pull it in transitively. A dummy value keeps the import
 * graph loadable; no test opens a connection.
 */
process.env.MONGODB_URI ??= "mongodb://127.0.0.1:27017/taskflow-test";
