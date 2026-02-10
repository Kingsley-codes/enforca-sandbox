import express from "express";
import { mentorAuthenticate } from "../middleware/authenticationMiddleware.js";
import {
  fetchMentees,
  createSession,
} from "../controllers/mentorDashboardController.js";

const mentorDashboardRouter = express.Router();

mentorDashboardRouter.get("/mentees", mentorAuthenticate, fetchMentees);
mentorDashboardRouter.post("/sessions", mentorAuthenticate, createSession);

export default mentorDashboardRouter;
