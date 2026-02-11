import express from "express";
import { mentorAuthenticate } from "../middleware/authenticationMiddleware.js";
import {
  fetchMentees,
  createSession,
  getAllAssignments,
  createAssignment,
  editAssignment,
  deleteAssignment,
} from "../controllers/mentorDashboardController.js";

const mentorDashboardRouter = express.Router();

mentorDashboardRouter.get("/mentees", mentorAuthenticate, fetchMentees);
mentorDashboardRouter.post("/sessions", mentorAuthenticate, createSession);

mentorDashboardRouter.get(
  "/assignments",
  mentorAuthenticate,
  getAllAssignments,
);

mentorDashboardRouter.post(
  "/assignments",
  mentorAuthenticate,
  createAssignment,
);

mentorDashboardRouter.patch(
  "/assignments/:id",
  mentorAuthenticate,
  editAssignment,
);

mentorDashboardRouter.delete(
  "/assignments/:id",
  mentorAuthenticate,
  deleteAssignment,
);

export default mentorDashboardRouter;
