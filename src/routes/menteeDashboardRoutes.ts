import express from "express";
import { userAuthenticate } from "../middleware/authenticationMiddleware.js";
import {
  fetchMyAssignments,
  fetchMySessions,
} from "../controllers/menteeDashboardControllers.js";

const menteeDashboardRouter = express.Router();

menteeDashboardRouter.get("/assignments", userAuthenticate, fetchMyAssignments);
menteeDashboardRouter.get("/sessions", userAuthenticate, fetchMySessions);

export default menteeDashboardRouter;
