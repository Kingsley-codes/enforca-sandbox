import { Request, Response } from "express";
import Mentor from "../models/mentorModel.js";
import User from "../models/userModel.js";
import Session from "../models/sessionModel.js";
import Assignment from "../models/assignmentModel.js";

export const fetchMentees = async (req: Request, res: Response) => {
  try {
    const mentorId = req.mentor;
    if (!mentorId) {
      return res.status(400).json({
        status: "error",
        message: "Unauthorized. Mentor not authenticated",
      });
    }

    const mentorCourse = await Mentor.findById(mentorId).select("course");

    const mentees = await User.find({ course: mentorCourse?.course }).select(
      "firstName lastName email course profilePhoto totalAttendance missed aveGrade progress",
    );

    if (!mentees || mentees.length === 0) {
      return res.status(404).json({
        status: "error",
        message: "No mentees found for this mentor",
      });
    }

    const menteesCount = await User.countDocuments({ course: mentorCourse });

    return res.status(200).json({
      status: "success",
      data: {
        menteesCount,
        mentees,
      },
    });
  } catch (error: any) {
    return res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
};

export const createSession = async (req: Request, res: Response) => {
  try {
    const mentor = req.mentor;

    if (!mentor) {
      return res.status(401).json({
        status: "fail",
        message: "Unauthorized. Mentor not authenticated.",
      });
    }

    const {
      title,
      date,
      time,
      timezone,
      meetingLink,
      objectives,
      attendees,
      notes,
      fileAttachments,
    } = req.body;

    // Basic validation
    if (
      !title ||
      !date ||
      !time ||
      !timezone ||
      !meetingLink ||
      !objectives ||
      !Array.isArray(objectives) ||
      objectives.length === 0
    ) {
      return res.status(400).json({
        status: "fail",
        message: "Missing or invalid required fields",
      });
    }

    const mentorCourse = await Mentor.findById(mentor).select("course");

    const mentees = await User.find({ course: mentorCourse?.course }).select(
      "_id",
    );

    const menteeIds = mentees.map((mentee) => mentee._id);

    const session = await Session.create({
      mentorId: mentor._id,
      title,
      date: new Date(date),
      time,
      timezone,
      course: mentorCourse?.course,
      meetingLink,
      objectives,
      attendees: attendees ? attendees : menteeIds,
      notes,
      fileAttachments,
    });

    return res.status(201).json({
      status: "success",
      data: {
        session,
      },
    });
  } catch (err: any) {
    console.error("Create session error:", err);

    return res.status(500).json({
      status: "error",
      message: "Failed to create session",
      error: err.message,
    });
  }
};

export const getAllAssignments = async (req: Request, res: Response) => {
  try {
    const mentorId = req.mentor;

    if (!mentorId) {
      return res.status(400).json({
        status: "error",
        message: "Unauthorized. Mentor not authenticated",
      });
    }

    const assignments = await Assignment.find({ mentorId });

    return res.status(200).json({
      status: "success",
      data: {
        assignments,
      },
    });
  } catch (error: any) {
    return res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
};
