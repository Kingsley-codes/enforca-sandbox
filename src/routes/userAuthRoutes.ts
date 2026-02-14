import express from "express";
import {
  registerUser,
  login,
  refreshToken,
  mentorLogin,
  mentorRefreshToken,
  changeMentorPassword,
  changeMenteePassword,
} from "../controllers/userAuthControllers.js";

const userAuthRouter = express.Router();

userAuthRouter.post("/users/register", registerUser); // User Registration routes
userAuthRouter.post("/users/login", login); // User Login route
userAuthRouter.post("/users/refresh-token", refreshToken); // User refresh token route
userAuthRouter.post("/users/change-password", changeMenteePassword); // User change password route
userAuthRouter.post("/mentors/login", mentorLogin); // User Login route
userAuthRouter.post("/mentors/refresh-token", mentorRefreshToken); // User refresh token route
userAuthRouter.post("/mentors/change-password", changeMentorPassword); // User change password route

export default userAuthRouter;
