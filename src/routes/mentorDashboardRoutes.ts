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

const mentorDashboardRouter = express.Router();

mentorDashboardRouter.get("/mentees", mentorAuthenticate, fetchMentees);

mentorDashboardRouter.get("/sessions", mentorAuthenticate, fetchAllsessions);

mentorDashboardRouter.post(
  "/sessions",
  mentorAuthenticate,
  uploadFileattachments,
  handleUploadErrors,
  createSession,
);

mentorDashboardRouter.patch(
  "/sessions/:id",
  mentorAuthenticate,
  uploadFileattachments,
  handleUploadErrors,
  editSession,
);

mentorDashboardRouter.patch(
  "/sessions/:id/reschedule",
  mentorAuthenticate,
  rescheduleSession,
);

mentorDashboardRouter.patch(
  "/sessions/:id/recording",
  mentorAuthenticate,
  addRecordingLink,
);

mentorDashboardRouter.delete(
  "/sessions/:id",
  mentorAuthenticate,
  deleteSession,
);

mentorDashboardRouter.get(
  "/assignments",
  mentorAuthenticate,
  getAllAssignments,
);

mentorDashboardRouter.post(
  "/assignments",
  mentorAuthenticate,
  uploadResource,
  handleUploadErrors,
  createAssignment,
);

mentorDashboardRouter.patch(
  "/assignments/:id",
  mentorAuthenticate,
  uploadResource,
  handleUploadErrors,
  editAssignment,
);

mentorDashboardRouter.delete(
  "/assignments/:id",
  mentorAuthenticate,
  deleteAssignment,
);

mentorDashboardRouter.get(
  "/submissions",
  mentorAuthenticate,
  getAllSubmissions,
);

mentorDashboardRouter.patch(
  "/submissions/:id",
  mentorAuthenticate,
  gradeSubmission,
);

export default mentorDashboardRouter;
