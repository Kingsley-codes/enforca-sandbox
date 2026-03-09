import express from "express";
import {
  assignMenteeTrainer,
  changeMenteeTrainer,
  fetchAllMentees,
  fetchMentors,
} from "../controllers/adminDashboardController.js";

const adminDashboardRouter = express.Router();

adminDashboardRouter.get("/mentees", fetchAllMentees);
adminDashboardRouter.get("/mentors/:course", fetchMentors);

adminDashboardRouter.get("/mentees/assign", assignMenteeTrainer);
adminDashboardRouter.get("/mentees/change", changeMenteeTrainer);

export default adminDashboardRouter;
