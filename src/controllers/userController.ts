import { Request, Response } from "express";
import User from "../models/userModel.js";
import Mentor from "../models/mentorModel.js";

export const fetchUserProfile = async (req: Request, res: Response) => {
  try {
    const userId = req.user;

    if (!userId) {
      return res.status(400).json({
        status: "error",
        message: "Unauthorized. User not authenticated",
      });
    }

    const user = await User.findById(userId).select("-password");

    if (!user) {
      return res.status(404).json({
        status: "error",
        message: "User not found",
      });
    }

    return res.status(200).json({
      status: "success",
      data: user,
    });
  } catch (error: any) {
    console.log("Error fetching user:", error);
    return res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
};

export const fetchMentorProfile = async (req: Request, res: Response) => {
  try {
    const mentorId = req.mentor;

    if (!mentorId) {
      return res.status(400).json({
        status: "error",
        message: "Unauthorized. Mentor not authenticated",
      });
    }

    const mentor = await Mentor.findById(mentorId).select("-password");

    if (!mentor) {
      return res.status(404).json({
        status: "error",
        message: "mentor not found",
      });
    }

    return res.status(200).json({
      status: "success",
      data: mentor,
    });
  } catch (error: any) {
    console.log("Error fetching mentor:", error);
    return res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
};
