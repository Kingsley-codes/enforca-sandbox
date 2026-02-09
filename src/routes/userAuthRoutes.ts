import express from "express";
import { registerUser, login } from "../controllers/authControllers.js";

const userAuthRouter = express.Router();

userAuthRouter.post("/register", registerUser); // User Registration routes

userAuthRouter.post("/login", login); // User Login route

export default userAuthRouter;
