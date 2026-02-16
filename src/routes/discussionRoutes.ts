import express from "express";
import { authenticate } from "../middleware/authenticationMiddleware.js";
import {
  fetchSubmissionDiscussion,
  sendDiscussion,
} from "../controllers/discussionController.js";

const discussionRouter = express.Router();

discussionRouter.post("/", authenticate, sendDiscussion);
discussionRouter.get("/", authenticate, fetchSubmissionDiscussion);

export default discussionRouter;
