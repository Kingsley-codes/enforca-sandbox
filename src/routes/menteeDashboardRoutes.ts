import express from "express";
import { userAuthenticate } from "../middleware/authenticationMiddleware.js";
import {
  fetchMyAssignments,
  fetchMyProjects,
  fetchMySessions,
  getSessionRecording,
  joinSession,
  makeSubmission,
} from "../controllers/menteeDashboardControllers.js";

const menteeDashboardRouter = express.Router();

menteeDashboardRouter.get("/tasks", userAuthenticate, fetchMyAssignments);

menteeDashboardRouter.get("/projects", userAuthenticate, fetchMyProjects);

menteeDashboardRouter.post(
  "/assignments/submit",
  userAuthenticate,
  makeSubmission,
);

menteeDashboardRouter.get("/sessions", userAuthenticate, fetchMySessions);

menteeDashboardRouter.get("/sessions/:id", userAuthenticate, joinSession);

menteeDashboardRouter.get(
  "/sessions/:id/recording",
  userAuthenticate,
  getSessionRecording,
);

export default menteeDashboardRouter;
