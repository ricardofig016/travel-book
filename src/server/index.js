// src/server/index.js
import express from "express";
import path from "path";
import { fileURLToPath } from "url";

// import markersRouter from "./routes/markers.js";
// import citiesRouter from "./routes/cities.js";
// import errorHandler from "./utils/errorHandler.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Middleware
app.use(express.json());

// Serve static assets
app.use(express.static(path.join(__dirname, "../client")));

// API Routes
// app.use("/api/markers", markersRouter);
// app.use("/api/cities", citiesRouter);

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
