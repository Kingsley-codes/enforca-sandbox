import express from "express";
import { userAuthenticate } from "../middleware/authenticationMiddleware.js";
import {
  fetchMyAssignments,
  fetchMyProjects,
  fetchMySessions,
  getSessionRecording,
  getSubmission,
  joinSession,
  makeSubmission,
} from "../controllers/menteeDashboardControllers.js";
import { uploadSubmissionFiles } from "../middleware/uploadMiddleware.js";

const menteeDashboardRouter = express.Router();

menteeDashboardRouter.get(
  "/assignments/tasks",
  userAuthenticate,
  fetchMyAssignments,
);

menteeDashboardRouter.get(
  "/assignments/projects",
  userAuthenticate,
  fetchMyProjects,
);

menteeDashboardRouter.get(
  "/assignments/submission/:assignmentId",
  userAuthenticate,
  getSubmission,
);

menteeDashboardRouter.post(
  "/assignments/submit",
  userAuthenticate,
  uploadSubmissionFiles,
  makeSubmission,
);

menteeDashboardRouter.get("/sessions", userAuthenticate, fetchMySessions);

menteeDashboardRouter.get(
  "/sessions/:sessionId",
  userAuthenticate,
  joinSession,
);

menteeDashboardRouter.get(
  "/sessions/:sessionId/recording",
  userAuthenticate,
  getSessionRecording,
);

export default menteeDashboardRouter;
