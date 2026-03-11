import express from "express";
import {
  assignMenteeTrainer,
  changeMenteeTrainer,
  fetchAllMentees,
  fetchLowCoinMentees,
  fetchMenteesSessions,
  fetchMentors,
  purchaseOverview,
} from "../controllers/adminDashboardController.js";
import { adminAuthenticate } from "../middleware/authenticationMiddleware.js";

const adminDashboardRouter = express.Router();

adminDashboardRouter.get("/mentees", adminAuthenticate, fetchAllMentees);
adminDashboardRouter.get("/mentors/:course", adminAuthenticate, fetchMentors);

adminDashboardRouter.get("/purchases", adminAuthenticate, purchaseOverview);
adminDashboardRouter.get("/mentees/low-coins", adminAuthenticate, fetchLowCoinMentees);
adminDashboardRouter.get("/mentees/sessions", adminAuthenticate, fetchMenteesSessions);

adminDashboardRouter.post("/mentees/assign", adminAuthenticate, assignMenteeTrainer);
adminDashboardRouter.post("/mentees/change", adminAuthenticate, changeMenteeTrainer);

export default adminDashboardRouter; 
