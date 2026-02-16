import express from "express";
import { mentorAuthenticate } from "../middleware/authenticationMiddleware.js";
import {
  fetchMentees,
  createSession,
  getAllAssignments,
  createAssignment,
  editAssignment,
  deleteAssignment,
  fetchAllsessions,
  editSession,
  deleteSession,
  rescheduleSession,
  addRecordingLink,
  gradeSubmission,
  getAllSubmissions,
} from "../controllers/mentorDashboardController.js";
import {
  handleUploadErrors,
  uploadFileattachments,
  uploadResource,
} from "../middleware/uploadMiddleware.js";
import { requireRole } from "../middleware/authorizationMiddleware.js";

const mentorDashboardRouter = express.Router();

mentorDashboardRouter.get(
  "/mentees",
  mentorAuthenticate,
  requireRole("mentor"),
  fetchMentees,
);

mentorDashboardRouter.get(
  "/sessions",
  mentorAuthenticate,
  requireRole("mentor"),
  fetchAllsessions,
);

mentorDashboardRouter.post(
  "/sessions",
  mentorAuthenticate,
  requireRole("mentor"),
  uploadFileattachments,
  handleUploadErrors,
  createSession,
);

mentorDashboardRouter.patch(
  "/sessions/:id",
  mentorAuthenticate,
  requireRole("mentor"),
  uploadFileattachments,
  handleUploadErrors,
  editSession,
);

mentorDashboardRouter.patch(
  "/sessions/:id/reschedule",
  mentorAuthenticate,
  requireRole("mentor"),
  rescheduleSession,
);

mentorDashboardRouter.patch(
  "/sessions/:id/recording",
  mentorAuthenticate,
  requireRole("mentor"),
  addRecordingLink,
);

mentorDashboardRouter.delete(
  "/sessions/:id",
  mentorAuthenticate,
  requireRole("mentor"),
  deleteSession,
);

mentorDashboardRouter.get(
  "/assignments",
  mentorAuthenticate,
  requireRole("mentor"),
  getAllAssignments,
);

mentorDashboardRouter.post(
  "/assignments",
  mentorAuthenticate,
  requireRole("mentor"),
  uploadResource,
  handleUploadErrors,
  createAssignment,
);

mentorDashboardRouter.patch(
  "/assignments/:id",
  mentorAuthenticate,
  requireRole("mentor"),
  uploadResource,
  handleUploadErrors,
  editAssignment,
);

mentorDashboardRouter.delete(
  "/assignments/:id",
  mentorAuthenticate,
  requireRole("mentor"),
  mentorAuthenticate,
  deleteAssignment,
);

mentorDashboardRouter.get(
  "/submissions",
  mentorAuthenticate,
  requireRole("mentor"),
  mentorAuthenticate,
  getAllSubmissions,
);

mentorDashboardRouter.patch(
  "/submissions/:id",
  mentorAuthenticate,
  requireRole("mentor"),
  mentorAuthenticate,
  gradeSubmission,
);

export default mentorDashboardRouter;
