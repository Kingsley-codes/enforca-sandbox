import express from "express";
import {
  registerUser,
  login,
  refreshToken,
  mentorLogin,
  mentorRefreshToken,
  changeMentorPassword,
  changeMenteePassword,
  adminLogin,
  changeAdminPassword,
} from "../controllers/userAuthControllers.js";

const userAuthRouter = express.Router();

userAuthRouter.post("/users/register", registerUser); // User Registration routes
userAuthRouter.post("/users/login", login); // User Login route
userAuthRouter.post("/users/refresh-token", refreshToken); // User refresh token route
userAuthRouter.post("/users/change-password", changeMenteePassword); // User change password route
userAuthRouter.post("/mentors/login", mentorLogin); // Mentor Login route
userAuthRouter.post("/mentors/refresh-token", mentorRefreshToken); // Mentor refresh token route
userAuthRouter.post("/mentors/change-password", changeMentorPassword); // Mentor change password route

userAuthRouter.post("/admin/login", adminLogin); // Admin Login route
userAuthRouter.post("/admin/change-password", changeAdminPassword); // Admin change password route

export default userAuthRouter;
