import express from "express";
import { authenticate } from "../middleware/authenticationMiddleware.js";
import {
  fetchSubmissionDiscussion,
  sendDiscussion,
} from "../controllers/discussionController.js";

const discussionRouter = express.Router();

discussionRouter.post("/:id", authenticate, sendDiscussion);
discussionRouter.get("/:id", authenticate, fetchSubmissionDiscussion);

export default discussionRouter;
