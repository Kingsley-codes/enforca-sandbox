import express from "express";
import {
  activateMentor,
  addMentor,
  assignMenteeTrainer,
  changeMenteeTrainer,
  fetchAllMentees,
  fetchLowCoinMentees,
  fetchMenteesSessions,
  fetchMentorDetails,
  fetchMentors,
  purchaseOverview,
  suspendMentor,
  transactionHistory,
} from "../controllers/adminDashboardController.js";
import { adminAuthenticate } from "../middleware/authenticationMiddleware.js";

const adminDashboardRouter = express.Router();

adminDashboardRouter.get("/mentors", adminAuthenticate, fetchMentors);
adminDashboardRouter.post("/mentors/add", adminAuthenticate, addMentor);
adminDashboardRouter.get(
  "/mentors/:mentorId",
  adminAuthenticate,
  fetchMentorDetails,
);
adminDashboardRouter.patch(
  "/mentors/:mentorId/suspend",
  adminAuthenticate,
  suspendMentor,
);
adminDashboardRouter.patch(
  "/mentors/:mentorId/activate",
  adminAuthenticate,
  activateMentor,
);

adminDashboardRouter.get("/purchases", adminAuthenticate, purchaseOverview);
adminDashboardRouter.get(
  "/transactions",
  adminAuthenticate,
  transactionHistory,
);

adminDashboardRouter.get("/mentees", adminAuthenticate, fetchAllMentees);
adminDashboardRouter.post(
  "/mentees/assign",
  adminAuthenticate,
  assignMenteeTrainer,
);
adminDashboardRouter.post(
  "/mentees/change",
  adminAuthenticate,
  changeMenteeTrainer,
);
adminDashboardRouter.get(
  "/mentees/low-coins",
  adminAuthenticate,
  fetchLowCoinMentees,
);
adminDashboardRouter.get(
  "/mentees/sessions",
  adminAuthenticate,
  fetchMenteesSessions,
);

export default adminDashboardRouter;
