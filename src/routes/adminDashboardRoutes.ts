import express from "express";
import {
  assignMenteeTrainer,
  changeMenteeTrainer,
  fetchAllMentees,
  fetchMentors,
  purchaseOverview,
} from "../controllers/adminDashboardController.js";

const adminDashboardRouter = express.Router();

adminDashboardRouter.get("/mentees", fetchAllMentees);
adminDashboardRouter.get("/mentors/:course", fetchMentors);

adminDashboardRouter.get("/purchases", purchaseOverview);

adminDashboardRouter.post("/mentees/assign", assignMenteeTrainer);
adminDashboardRouter.post("/mentees/change", changeMenteeTrainer);

export default adminDashboardRouter;
