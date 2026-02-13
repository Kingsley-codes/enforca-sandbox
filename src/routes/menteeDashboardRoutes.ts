import express from "express";
import { userAuthenticate } from "../middleware/authenticationMiddleware.js";
import {
  fetchMyAssignments,
  fetchMySessions,
  makeSubmission,
} from "../controllers/menteeDashboardControllers.js";

const menteeDashboardRouter = express.Router();

menteeDashboardRouter.get("/assignments", userAuthenticate, fetchMyAssignments);
menteeDashboardRouter.post(
  "/assignments/submit",
  userAuthenticate,
  makeSubmission,
);
menteeDashboardRouter.get("/sessions", userAuthenticate, fetchMySessions);

export default menteeDashboardRouter;
