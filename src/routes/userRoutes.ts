import express from "express";
import { userAuthenticate } from "../middleware/authenticationMiddleware.js";
import {
  fetchMentorProfile,
  fetchUserProfile,
} from "../controllers/userController.js";

const userRouter = express.Router();

userRouter.get("/mentee", userAuthenticate, fetchUserProfile);
userRouter.get("/mentor", userAuthenticate, fetchMentorProfile);

export default userRouter;
