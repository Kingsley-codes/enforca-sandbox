import { Request, Response, NextFunction } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";
import User from "../models/userModel.js";
import Mentor from "../models/mentorModel.js";
import Admin from "../models/adminModel.js";

interface UserJwtPayload extends JwtPayload {
  id: string;
}

interface MentorJwtPayload extends JwtPayload {
  id: string;
}

interface AdminJwtPayload extends JwtPayload {
  id: string;
}

// Protection Middleware
export const userAuthenticate = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    let token = req.cookies.access_token;

    if (!token) {
      res.status(401).json({
        status: "fail",
        message: "Not authorized, no token",
      });
      return;
    }

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET as string,
    ) as UserJwtPayload;

    const currentUser = await User.findById(decoded.id);
    if (!currentUser) {
      res.status(401).json({
        status: "fail",
        message: "User not found",
      });
      return;
    }

    req.user = currentUser._id;
    next();
  } catch (err: any) {
    console.error("Protect error:", err);
    const message =
      err.name === "JsonWebTokenError"
        ? "Invalid token"
        : err.name === "TokenExpiredError"
          ? "Session expired"
          : err.message;

    res.status(401).json({
      status: "fail",
      message,
    });
  }
};

export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    let token = req.cookies.access_token;

    if (!token) {
      res.status(401).json({
        status: "fail",
        message: "Not authorized, no token",
      });
      return;
    }

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET as string,
    ) as UserJwtPayload;

    let currentUser = await User.findById(decoded.id).select("-password");
    if (currentUser) {
      req.user = currentUser._id;
      return next();
    } else {
      currentUser = await Mentor.findById(decoded.id).select("-password");

      if (currentUser) {
        req.mentor = currentUser._id;
        return next();
      }
    }

    if (!currentUser) {
      res.status(401).json({
        status: "fail",
        message: "User not found",
      });
      return;
    }
  } catch (err: any) {
    console.error("Protect error:", err);
    const message =
      err.name === "JsonWebTokenError"
        ? "Invalid token"
        : err.name === "TokenExpiredError"
          ? "Session expired"
          : err.message;

    res.status(401).json({
      status: "fail",
      message,
    });
  }
};

export const mentorAuthenticate = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    let token = req.cookies.access_token;

    if (!token) {
      res.status(401).json({
        status: "fail",
        message: "Not authorized, no token",
      });
      return;
    }

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET as string,
    ) as MentorJwtPayload;

    const currentUser = await Mentor.findById(decoded.id);
    if (!currentUser) {
      res.status(401).json({
        status: "fail",
        message: "Mentor not found",
      });
      return;
    }

    req.mentor = currentUser._id;
    next();
  } catch (err: any) {
    console.error("Protect error:", err);
    const message =
      err.name === "JsonWebTokenError"
        ? "Invalid token"
        : err.name === "TokenExpiredError"
          ? "Session expired"
          : err.message;

    res.status(401).json({
      status: "fail",
      message,
    });
  }
};

export const adminAuthenticate = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    let token = req.cookies.access_token;

    if (!token) {
      res.status(401).json({
        status: "fail",
        message: "Not authorized, no token",
      });
      return;
    }

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET as string,
    ) as AdminJwtPayload;

    const currentUser = await Admin.findById(decoded.id);
    if (!currentUser) {
      res.status(401).json({
        status: "fail",
        message: "Mentor not found",
      });
      return;
    }

    req.admin = currentUser._id;
    next();
  } catch (err: any) {
    console.error("Protect error:", err);
    const message =
      err.name === "JsonWebTokenError"
        ? "Invalid token"
        : err.name === "TokenExpiredError"
          ? "Session expired"
          : err.message;

    res.status(401).json({
      status: "fail",
      message,
    });
  }
};
