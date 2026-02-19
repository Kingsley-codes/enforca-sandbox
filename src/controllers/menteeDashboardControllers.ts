import { Request, Response } from "express";
import Session from "../models/sessionModel.js";
import Assignment from "../models/assignmentModel.js";
import { DateFilterType, getDateRange } from "../helpers/filter.js";
import Submission from "../models/submissionModel.js";
import {
  deleteFromCloudinary,
  uploadImageToCloudinary,
  uploadToCloudinary,
} from "../middleware/uploadMiddleware.js";
import User from "../models/userModel.js";
import { parseFormArray } from "../helpers/parseFormArray.js";
import Discussion from "../models/discussionsModel.js";

export const fetchMyAssignments = async (req: Request, res: Response) => {
  try {
    const menteeId = req.user;
    if (!menteeId) {
      return res.status(400).json({
        status: "error",
        message: "Unauthorized. Mentee not authenticated",
      });
    }

    const { filterType, referenceDate, offset } = req.query as {
      filterType?: DateFilterType;
      referenceDate?: string;
      offset?: string;
    };

    let dateQuery = {};
    let currentPeriodLabel = null;

    if (filterType) {
      const { start, end } = getDateRange(
        filterType,
        referenceDate ? new Date(referenceDate) : undefined,
        offset ? parseInt(offset) : 0,
      );

      dateQuery = { dueDate: { $gte: start, $lte: end } };

      // For frontend navigation labels
      currentPeriodLabel =
        filterType === "day"
          ? start.toISOString().slice(0, 10) // YYYY-MM-DD
          : filterType === "week"
            ? `${start.toISOString().slice(0, 10)} to ${end
                .toISOString()
                .slice(0, 10)}`
            : `${start.toLocaleString("default", {
                month: "long",
                year: "numeric",
              })}`;
    }

    const assignments = await Assignment.find(
      {
        "mentees.user": menteeId,
        category: "task",
        ...dateQuery,
      },
      {
        mentees: { $elemMatch: { user: menteeId } },
        mentor: 0,
      },
    ).sort({ createdAt: -1 });

    return res.status(200).json({
      status: "success",
      data: {
        assignments,
        currentPeriod: currentPeriodLabel, // e.g., "2026-02-12" for daily
      },
    });
  } catch (error: any) {
    console.log("Error fetching mentee assignments:", error);
    return res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
};

export const fetchMyProjects = async (req: Request, res: Response) => {
  try {
    const menteeId = req.user;

    if (!menteeId) {
      return res.status(401).json({
        status: "error",
        message: "Unauthorized. Mentee not authenticated",
      });
    }

    const mentee = await User.findById(menteeId);

    if (!mentee) {
      return res.status(404).json({
        status: "error",
        message: "Mentee not found",
      });
    }

    if (!mentee.isPremium) {
      return res.status(400).json({
        status: "error",
        message: "This feature is only available to premium users",
      });
    }

    const projects = await Assignment.find(
      {
        "mentees.user": menteeId,
        category: "project",
      },
      {
        mentees: { $elemMatch: { user: menteeId } },
        mentor: 0,
      },
    ).sort({ createdAt: -1 });

    return res.status(200).json({
      status: "success",
      data: projects,
    });
  } catch (error: any) {
    console.log("Error fetching mentee projects:", error);
    return res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
};

export const fetchMySessions = async (req: Request, res: Response) => {
  try {
    const menteeId = req.user;

    if (!menteeId) {
      return res.status(401).json({
        status: "error",
        message: "Unauthorized. Mentee not authenticated",
      });
    }

    const { filterType, referenceDate, offset } = req.query as {
      filterType?: DateFilterType;
      referenceDate?: string;
      offset?: string;
    };

    let dateQuery = {};
    let currentPeriodLabel = null;

    if (filterType) {
      const { start, end } = getDateRange(
        filterType,
        referenceDate ? new Date(referenceDate) : undefined,
        offset ? parseInt(offset) : 0,
      );

      dateQuery = { dueDate: { $gte: start, $lte: end } };

      // For frontend navigation labels
      currentPeriodLabel =
        filterType === "day"
          ? start.toISOString().slice(0, 10) // YYYY-MM-DD
          : filterType === "week"
            ? `${start.toISOString().slice(0, 10)} to ${end
                .toISOString()
                .slice(0, 10)}`
            : `${start.toLocaleString("default", {
                month: "long",
                year: "numeric",
              })}`;
    }

    const session = await Session.find({
      attendees: menteeId,
      ...dateQuery,
    })
      .select("-mentor -attendees -recordingLink")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      status: "success",
      data: {
        session,
        currentPeriod: currentPeriodLabel, // e.g., "2026-02-12" for daily
      },
    });
  } catch (error: any) {
    console.log("Error fetching mentee session:", error);

    return res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
};

export const joinSession = async (req: Request, res: Response) => {
  try {
    const menteeId = req.user;
    const { sessionId } = req.params;

    if (!menteeId) {
      return res.status(401).json({
        status: "error",
        message: "Unauthorized. Mentee not authenticated",
      });
    }

    const mentee = await User.findById(menteeId);

    if (!mentee) {
      return res.status(404).json({
        status: "error",
        message: "Mentee not found",
      });
    }

    if (mentee.unusedCoins < 500) {
      return res.status(400).json({
        status: "error",
        message: "Not enough coins",
      });
    }

    const session = await Session.findOne({
      _id: sessionId,
      attendees: menteeId,
    });

    if (!session) {
      return res.status(404).json({
        status: "error",
        message: "Session not found",
      });
    }

    const meetinLink = session.meetingLink;

    if (!meetinLink) {
      return res.status(404).json({
        status: "error",
        message: "Session meeting link not found",
      });
    }

    const alreadyAttended = mentee.sessions?.some(
      (s) => s.session.toString() === sessionId && s.attended === true,
    );

    if (alreadyAttended) {
      return res.status(200).json({
        status: "success",
        data: {
          meetinLink,
          unusedcoins: mentee.unusedCoins,
        },
      });
    }

    // ✅ mark this session as attended for this user
    await User.updateOne(
      {
        _id: menteeId,
        "sessions.session": session._id,
      },
      {
        $set: {
          "sessions.$.attended": true,
        },
      },
    );

    mentee.unusedCoins -= 500;
    mentee.totalCoinsSpent += 500;
    mentee.totalAttendance += 1;
    await mentee.save();

    return res.status(200).json({
      status: "success",
      data: {
        meetinLink,
        unusedcoins: mentee.unusedCoins,
      },
    });
  } catch (error: any) {
    console.log("Error fetching session meeting link:", error);

    return res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
};

export const getSessionRecording = async (req: Request, res: Response) => {
  try {
    const menteeId = req.user;
    const { sessionId } = req.params;

    if (!menteeId) {
      return res.status(401).json({
        status: "error",
        message: "Unauthorized. Mentee not authenticated",
      });
    }

    const mentee = await User.findById(menteeId);

    if (!mentee) {
      return res.status(404).json({
        status: "error",
        message: "Mentee not found",
      });
    }

    if (mentee.unusedCoins < 500) {
      return res.status(400).json({
        status: "error",
        message: "Not enough coins",
      });
    }

    const session = await Session.findOne({
      _id: sessionId,
      attendees: menteeId,
    });

    if (!session) {
      return res.status(404).json({
        status: "error",
        message: "Session not found",
      });
    }

    const sessionRecording = session.recordingLink;

    if (!sessionRecording) {
      return res.status(404).json({
        status: "error",
        message: "Session does not have uploaded recording",
      });
    }

    mentee.unusedCoins -= 500;
    mentee.totalCoinsSpent += 500;
    await mentee.save();

    return res.status(200).json({
      status: "success",
      data: {
        sessionRecording,
        unusedcoins: mentee.unusedCoins,
      },
    });
  } catch (error: any) {
    console.log("Error fetching session recording link:", error);

    return res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
};

export const makeSubmission = async (req: Request, res: Response) => {
  try {
    const menteeId = req.user;

    if (!menteeId) {
      return res.status(401).json({
        status: "error",
        message: "Unauthorized. Mentee not authenticated",
      });
    }

    const { submittedLinks, assignmentId, submissionNotes } = req.body;

    if (!assignmentId || !submissionNotes) {
      return res.status(400).json({
        status: "error",
        message: "Missing required fields",
      });
    }

    const mentee = await User.findById(menteeId);

    if (!mentee) {
      return res.status(404).json({
        status: "error",
        message: "Mentee not found",
      });
    }

    if (mentee.unusedCoins < 500) {
      return res.status(400).json({
        status: "error",
        message: "Not enough coins",
      });
    }

    const assignment = await Assignment.findById(assignmentId);

    if (!assignment) {
      return res.status(404).json({
        status: "error",
        message: "Assignment not found or not accessible",
      });
    }

    const existingSubmission = await Submission.findOne({
      assignment: assignmentId,
      mentee: menteeId,
    });

    if (existingSubmission) {
      console.log(
        "Submission already exists for this assignment",
        existingSubmission,
      );

      return res.status(409).json({
        status: "error",
        message: "Assignment already submitted for this user",
      });
    }

    // links added from the "Add link" modal
    const linkResources = parseFormArray<{ filename: string; url: string }>(
      submittedLinks,
    );

    // 1. Upload submittedFiles (if any)
    const files = (
      req.files as {
        submittedFiles?: Express.Multer.File[];
      }
    )?.submittedFiles;

    let uploadedResources: {
      filename: string;
      publicId: string;
      url: string;
    }[] = [];

    if (files && files.length > 0) {
      const uploads = files.map(async (file) => {
        const result = await uploadToCloudinary(
          file.buffer,
          "Enforca Sandbox/submissions",
          file.originalname,
        );

        return {
          filename: file.originalname,
          url: result.secure_url,
          publicId: result.public_id,
        };
      });

      uploadedResources = await Promise.all(uploads);
    }

    const newSubmission = await Submission.create({
      assignment: assignmentId,
      mentee: menteeId,
      mentor: assignment.mentor,
      title: assignment.title,
      submissionNotes: submissionNotes,
      submissionDate: new Date(),
      submittedFiles: uploadedResources,
      submittedLinks: linkResources,
    });

    // Create discussion for the submission
    const newDiscussion = await Discussion.create({
      submission: newSubmission._id,
      mentee: menteeId,
      mentor: assignment.mentor,
    });

    await Assignment.updateOne(
      {
        _id: assignmentId,
        "mentees.user": menteeId,
      },
      {
        $set: {
          "mentees.$.status": "submitted",
        },
      },
    );

    mentee.unusedCoins -= 500;
    mentee.totalCoinsSpent += 500;
    await mentee.save();

    return res.status(201).json({
      status: "success",
      data: {
        newSubmission,
        unusedcoins: mentee.unusedCoins,
      },
    });
  } catch (error: any) {
    console.error("Create submission error:", error);

    return res.status(500).json({
      status: "error",
      message: "Failed to create submission",
      error: error.message,
    });
  }
};

export const getSubmission = async (req: Request, res: Response) => {
  try {
    const menteeId = req.user;

    if (!menteeId) {
      return res.status(401).json({
        status: "error",
        message: "Unauthorized. Mentee not authenticated",
      });
    }

    const { assignmentId } = req.params;

    const submission = await Submission.findOne({
      assignment: assignmentId,
      mentee: menteeId,
    });

    if (!submission) {
      return res.status(404).json({
        status: "error",
        message: "Submission not found",
      });
    }

    return res.status(200).json({
      status: "success",
      data: submission,
    });
  } catch (error: any) {
    console.log("Error fetching submission:", error);

    return res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
};

export const editMenteeProfile = async (req: Request, res: Response) => {
  try {
    const menteeId = req.user;

    if (!menteeId) {
      return res.status(401).json({
        status: "error",
        message: "Unauthorized. Mentee not authenticated",
      });
    }

    const { firstName, lastName, phoneNumber, address, gender } = req.body;

    const mentee = await User.findById(menteeId).select("-password -sessions");

    if (!mentee) {
      return res.status(404).json({
        status: "error",
        message: "Mentor not found",
      });
    }

    const file = (req.files as { profilePhoto?: Express.Multer.File[] })
      ?.profilePhoto?.[0];

    if (file) {
      const uploaded = await uploadImageToCloudinary(
        file.buffer,
        "Enforca Sandbox/Profile Photos",
      );

      if (mentee.profilePhoto?.publicId) {
        await deleteFromCloudinary(mentee.profilePhoto.publicId);
      }

      // save new image info
      mentee.profilePhoto = {
        publicId: uploaded.public_id,
        url: uploaded.secure_url,
      };
    }

    if (firstName) mentee.firstName = firstName;
    if (lastName) mentee.lastName = lastName;
    if (phoneNumber) mentee.phoneNumber = phoneNumber;
    if (address) mentee.address = address;
    if (gender) mentee.gender = gender;

    await mentee.save();

    return res.status(200).json({
      status: "success",
      message: "Profile updated successfully",
      data: mentee,
    });
  } catch (error: any) {
    console.log("Error editing mentee profile:", error);
    return res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
};
