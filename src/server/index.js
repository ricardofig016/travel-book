import express from "express";
import path from "path";
import { fileURLToPath } from "url";

// import errorHandler from "./utils/errorHandler.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Middleware
app.use(express.json());

// Serve static assets
const CLIENT_DIR = path.join(__dirname, "../client");
app.use(express.static(CLIENT_DIR));

// Redirect to index.html for all routes
app.get("/*splat", (req, res) => res.sendFile(path.join(CLIENT_DIR, "index.html")));

// 404 Handler
app.use((req, res, next) => {
  res.status(404).json({ error: "Not Found" });
});

// Error Handler
// app.use(errorHandler);

// Start Server
const PORT = process.env.PORT ?? 3000;
app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
