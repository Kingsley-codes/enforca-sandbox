import express from "express";
import {
  assignMenteeTrainer,
  changeMenteeTrainer,
  fetchAllMentees,
  fetchMentors,
  purchaseOverview,
} from "../controllers/adminDashboardController.js";
import { adminAuthenticate } from "../middleware/authenticationMiddleware.js";

const adminDashboardRouter = express.Router();

adminDashboardRouter.get("/mentees", adminAuthenticate, fetchAllMentees);
adminDashboardRouter.get("/mentors/:course", adminAuthenticate, fetchMentors);

adminDashboardRouter.get("/purchases", adminAuthenticate, purchaseOverview);

adminDashboardRouter.post("/mentees/assign", adminAuthenticate, assignMenteeTrainer);
adminDashboardRouter.post("/mentees/change", adminAuthenticate, changeMenteeTrainer);

export default adminDashboardRouter; 
