import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import { aiRateLimiter } from "./services/aiService.js";
import dotenv from "dotenv";
import curateResourcesRouter from "./routes/curateResources.js";
import generatePlanRouter from "./routes/generatePlan.js";
import pdfChatRouter from "./routes/pdfChat.js";
import rateLimit from "express-rate-limit";
import { mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import authMiddleware from "./middleware/authMiddleware.js";
import cookieParser from "cookie-parser"; // Add this import

// Load environment variables
dotenv.config();

// Ensure required directories exist
const uploadsDir = path.join(process.cwd(), "uploads");
if (!existsSync(uploadsDir)) {
  await mkdir(uploadsDir, { recursive: true });
  console.log("Created uploads directory");
}

const app = express();
const port = process.env.PORT || 5000;

// Trust proxy - required for rate limiting behind reverse proxies
app.set("trust proxy", 1);

// Middleware
app.use(cookieParser()); // Add cookie parsing middleware
app.use(express.json());

app.use(
  cors({
    origin: [
      "https://mind-mentor-pearl.vercel.app",
      "https://mind-mentor.kartiklabhshetwar.me",
      "http://localhost:3000",
    ],
    credentials: true, // Allow cookies to be sent
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization", "x-auth-token"],
  })
);

// Rate limiting configuration
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: "Too many requests from this IP, please try again after 15 minutes",
  trustProxy: true,
});

app.use(limiter);

// Apply rate limiter to AI-related routes
app.use("/api/resources", aiRateLimiter);
app.use("/api/study-plan", aiRateLimiter);

// Basic health check
app.get("/", (req, res) => {
  res.json({ status: "ok", message: "Mind Mentor API is running" });
});

// Connect to MongoDB
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("MongoDB connection error:", err));

// Apply routes with auth middleware
app.use("/generate-plan", authMiddleware, generatePlanRouter);
app.use("/curate-resources", authMiddleware, curateResourcesRouter);
app.use("/pdf", authMiddleware, pdfChatRouter);

// Error handling middleware
app.use((err, req, res) => {
  // Add 'next' parameter
  console.error(err.stack);
  res.status(500).json({ error: "Something went wrong!" });
});

app.listen(port, "0.0.0.0", () => {
  console.log(`Server is running on port ${port}`);
});
