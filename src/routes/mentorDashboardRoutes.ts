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
  fetchMenteeProjects,
  fetchMenteeAssignments,
  fetchMenteesList,
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
  "/sessions/:sessionId",
  mentorAuthenticate,
  requireRole("mentor"),
  uploadFileattachments,
  handleUploadErrors,
  editSession,
);

mentorDashboardRouter.patch(
  "/sessions/:sessionId/reschedule",
  mentorAuthenticate,
  requireRole("mentor"),
  rescheduleSession,
);

mentorDashboardRouter.patch(
  "/sessions/:sessionId/recording",
  mentorAuthenticate,
  requireRole("mentor"),
  addRecordingLink,
);

mentorDashboardRouter.delete(
  "/sessions/:sessionId",
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
  "/assignments/:assignmentId",
  mentorAuthenticate,
  requireRole("mentor"),
  uploadResource,
  handleUploadErrors,
  editAssignment,
);

mentorDashboardRouter.delete(
  "/assignments/:assignmentId",
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
  "/submissions/:submissionId",
  mentorAuthenticate,
  requireRole("mentor"),
  mentorAuthenticate,
  gradeSubmission,
);

mentorDashboardRouter.get(
  "/mentee-projects/:id",
  mentorAuthenticate,
  requireRole("mentor"),
  mentorAuthenticate,
  fetchMenteeProjects,
);

mentorDashboardRouter.get(
  "/mentee-tasks/:id",
  mentorAuthenticate,
  requireRole("mentor"),
  fetchMenteeAssignments,
);

mentorDashboardRouter.get(
  "/sessions/mentees",
  mentorAuthenticate,
  requireRole("mentor"),
  fetchMenteesList,
);

export default mentorDashboardRouter;
