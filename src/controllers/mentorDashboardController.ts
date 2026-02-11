import { Request, Response } from "express";
import Mentor from "../models/mentorModel.js";
import User from "../models/userModel.js";
import Session from "../models/sessionModel.js";
import Assignment from "../models/assignmentModel.js";
import {
  buildDateFilter,
  buildSessionTimezoneMatch,
  DateFilter,
} from "../helpers/filter.js";

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

export const editSession = async (req: Request, res: Response) => {
  try {
    const mentor = req.mentor;
    const sessionId = req.params.id;

    if (!mentor) {
      return res.status(400).json({
        status: "error",
        message: "Unauthorized. Mentor not authenticated",
      });
    }

    const session = await Session.findOne({
      _id: sessionId,
      mentor: mentor,
    });

    if (!session) {
      return res.status(404).json({
        status: "error",
        message: "Session not found or not accessible",
      });
    }

    const {
      title,
      notes,
      fileAttachments,
      attendees,
      date,
      time,
      objectives,
      timezone,
      meetingLink,
    } = req.body;

    if (title) session.title = title;
    if (notes) session.notes = notes;
    if (fileAttachments) session.fileAttachments = fileAttachments;
    if (attendees) session.attendees = attendees;
    if (date) session.date = new Date(date);
    if (time) session.time = time;
    if (objectives) session.objectives = objectives;
    if (timezone) session.timezone = timezone;
    if (meetingLink) session.meetingLink = meetingLink;

    await session.save();

    return res.status(200).json({
      status: "success",
      data: session,
    });
  } catch (error: any) {
    console.log("Error editing session:", error);
    return res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
};

export const deleteSession = async (req: Request, res: Response) => {
  try {
    const mentorId = req.mentor;
    const sessionId = req.params.id;

    if (!mentorId) {
      return res.status(400).json({
        status: "error",
        message: "Unauthorized. Mentor not authenticated",
      });
    }

    const session = await Session.findOneAndDelete({
      _id: sessionId,
      mentor: mentorId,
    });

    if (!session) {
      return res.status(404).json({
        status: "error",
        message: "Session not found or not accessible",
      });
    }

    return res.status(200).json({
      status: "success",
      message: "Session deleted successfully",
    });
  } catch (error: any) {
    console.log("Error deleting Session:", error);
    return res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
};

export const rescheduleSession = async (req: Request, res: Response) => {
  try {
    const mentor = req.mentor;
    const sessionId = req.params.id;

    if (!mentor) {
      return res.status(400).json({
        status: "error",
        message: "Unauthorized. Mentor not authenticated",
      });
    }

    const { date, time, timezone } = req.body;

    const session = await Session.findOne({
      _id: sessionId,
      mentor: mentor,
    });

    if (!session) {
      return res.status(404).json({
        status: "error",
        message: "Session not found or not accessible",
      });
    }

    if (date) session.date = new Date(date);
    if (time) session.time = time;
    if (timezone) session.timezone = timezone;

    await session.save();

    return res.status(200).json({
      status: "success",
      message: "Session rescheduled successfully",
    });
  } catch (error: any) {
    console.log("Error editing session:", error);
    return res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
};

export const fetchAllsessions = async (req: Request, res: Response) => {
  try {
    const mentorId = req.mentor;

    if (!mentorId) {
      return res.status(400).json({
        status: "error",
        message: "Unauthorized. Mentor not authenticated",
      });
    }

    const dateFilter = buildSessionTimezoneMatch(
      req.query.filter as DateFilter,
    );

    const pipeline: any[] = [{ $match: { mentorId } }];

    if (dateFilter) {
      pipeline.push({ $match: dateFilter });
    }

    const sessions = await Session.find(pipeline);

    return res.status(200).json({
      status: "success",
      data: { sessions },
    });
  } catch (error: any) {
    console.log("Error fetching sessions:", error);
    return res.status(500).json({
      status: "error",
      message: error.message,
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

    const dateFilter = buildDateFilter(req.query.filter as DateFilter);

    const query: any = {
      mentor: mentorId,
      status: "active",
    };

    if (dateFilter) {
      query.dueDate = dateFilter;
    }

    const assignments = await Assignment.find(query).sort({
      dueDate: -1,
    });

    return res.status(200).json({
      status: "success",
      data: {
        assignments,
      },
    });
  } catch (error: any) {
    console.log("Error fetching assignments:", error);
    return res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
};

export const createAssignment = async (req: Request, res: Response) => {
  try {
    const mentorId = req.mentor;
    if (!mentorId) {
      return res.status(400).json({
        status: "error",
        message: "Unauthorized. Mentor not authenticated",
      });
    }

    const {
      title,
      description,
      resources,
      mentees,
      dueDate,
      week,
      category,
      dueTime,
    } = req.body;

    if (!title || !description || !dueDate || !category || !dueTime) {
      return res.status(400).json({
        status: "error",
        message: "Missing required fields",
      });
    }

    const mentorCourse = await Mentor.findById(mentorId).select("course");

    const allMentees = await User.find({ course: mentorCourse?.course }).select(
      "_id",
    );

    const menteeIds = allMentees.map((mentee) => mentee._id);

    const assignment = await Assignment.create({
      mentor: mentorId,
      title,
      description,
      resources,
      mentees: mentees && mentees.length > 0 ? mentees : menteeIds,
      dueDate: new Date(dueDate),
      week,
      category,
      course: mentorCourse?.course,
      dueTime,
    });

    return res.status(201).json({
      status: "success",
      data: assignment,
    });
  } catch (error: any) {
    console.log("Error creating assignment:", error);
    return res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
};

export const editAssignment = async (req: Request, res: Response) => {
  try {
    const mentorId = req.mentor;
    const assignmentId = req.params.id;

    if (!mentorId) {
      return res.status(400).json({
        status: "error",
        message: "Unauthorized. Mentor not authenticated",
      });
    }

    const assignment = await Assignment.findOne({
      _id: assignmentId,
      mentor: mentorId,
    });

    if (!assignment) {
      return res.status(404).json({
        status: "error",
        message: "Assignment not found or not accessible",
      });
    }

    const {
      title,
      description,
      resources,
      mentees,
      dueDate,
      week,
      category,
      dueTime,
      status,
    } = req.body;

    if (title) assignment.title = title;
    if (description) assignment.description = description;
    if (resources) assignment.resources = resources;
    if (mentees) assignment.mentees = mentees;
    if (dueDate) assignment.dueDate = new Date(dueDate);
    if (week) assignment.week = week;
    if (category) assignment.category = category;
    if (dueTime) assignment.dueTime = dueTime;
    if (status) assignment.status = status;

    await assignment.save();

    return res.status(200).json({
      status: "success",
      data: assignment,
    });
  } catch (error: any) {
    console.log("Error editing assignment:", error);
    return res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
};

export const deleteAssignment = async (req: Request, res: Response) => {
  try {
    const mentorId = req.mentor;
    const assignmentId = req.params.id;

    if (!mentorId) {
      return res.status(400).json({
        status: "error",
        message: "Unauthorized. Mentor not authenticated",
      });
    }

    const assignment = await Assignment.findOneAndDelete({
      _id: assignmentId,
      mentor: mentorId,
    });

    if (!assignment) {
      return res.status(404).json({
        status: "error",
        message: "Assignment not found or not accessible",
      });
    }

    return res.status(200).json({
      status: "success",
      message: "Assignment deleted successfully",
    });
  } catch (error: any) {
    console.log("Error deleting assignment:", error);
    return res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
};
