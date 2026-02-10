import { Request, Response, NextFunction } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";
import User from "../models/userModel.js";
import Mentor from "../models/mentorModel.js";

interface UserJwtPayload extends JwtPayload {
  id: string;
}

interface MentorJwtPayload extends JwtPayload {
  id: string;
}

// Protection Middleware
export const userAuthenticate = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    let token = req.cookies.access_token;

    if (!token) {
      return res.status(401).json({
        status: "fail",
        message: "Not authorized, no token",
      });
    }

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET as string,
    ) as UserJwtPayload;

    const currentUser = await User.findById(decoded.id);
    if (!currentUser) throw new Error("User not found");

    return (req.user = currentUser._id);
    next();
  } catch (err: any) {
    console.error("Protect error:", err);
    const message =
      err.name === "JsonWebTokenError"
        ? "Invalid token"
        : err.name === "TokenExpiredError"
          ? "Session expired"
          : err.message;

    return res.status(401).json({
      status: "fail",
      message,
    });
  }
};

export const mentorAuthenticate = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    let token = req.cookies.access_token;

    if (!token) {
      return res.status(401).json({
        status: "fail",
        message: "Not authorized, no token",
      });
    }

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET as string,
    ) as MentorJwtPayload;

    const currentUser = await Mentor.findById(decoded.id);
    if (!currentUser) throw new Error("Mentor not found");

    return (req.mentor = currentUser._id);
    next();
  } catch (err: any) {
    console.error("Protect error:", err);
    const message =
      err.name === "JsonWebTokenError"
        ? "Invalid token"
        : err.name === "TokenExpiredError"
          ? "Session expired"
          : err.message;

    return res.status(401).json({
      status: "fail",
      message,
    });
  }
};
