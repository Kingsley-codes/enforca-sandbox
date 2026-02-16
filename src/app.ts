import express from "express";
import compression from "compression";
import "dotenv/config";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import cors from "cors";
import { sanitize } from "./middleware/mongodbSantizer.js";
import authRouter from "./routes/userAuthRoutes.js";
import mentorDashboardRouter from "./routes/mentorDashboardRoutes.js";
import userAuthRouter from "./routes/userAuthRoutes.js";
import menteeDashboardRouter from "./routes/menteeDashboardRoutes.js";
import paymentRouter from "./routes/paymentRoutes.js";
import discussionRouter from "./routes/discussionRoutes.js";

// Rate limiting configuration
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: "Too many requests from this IP, please try again later",
});

const allowedOrigins = [
  process.env.FRONTEND_URL,
  process.env.FRONTEND_LOCALHOST,
].filter(Boolean) as string[];

const app = express();

// Middleware
app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  }),
);

app.use(express.json());
app.use(compression());
app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));
app.use(helmet());
app.use(limiter);
app.use((req, res, next) => {
  req.body = sanitize(req.body);
  req.params = sanitize(req.params);

  // Mutate req.query in-place without overwriting it
  for (const key in req.query) {
    if (key.startsWith("$") || key.includes(".")) {
      delete req.query[key];
    }
  }
  next();
});

// Define API routes
app.use("/api/auth", authRouter); // Register auth routes
app.use("/api/mentor", mentorDashboardRouter); // Register mentor dashboard routes
app.use("/api/mentee", menteeDashboardRouter); // Register mentor dashboard routes
app.use("/api/users", userAuthRouter); // Register mentor dashboard routes
app.use("/api/discussions", discussionRouter); // Register mentor dashboard routes
app.use("/api/payment", paymentRouter); // Register mentor dashboard routes

export default app;
