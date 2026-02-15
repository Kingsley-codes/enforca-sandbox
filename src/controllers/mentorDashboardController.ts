import { Request, Response } from "express";
import Mentor from "../models/mentorModel.js";
import User from "../models/userModel.js";
import Session from "../models/sessionModel.js";
import Assignment from "../models/assignmentModel.js";
import { DateFilterType, getDateRange } from "../helpers/filter.js";
import {
  deleteFromCloudinary,
  uploadToCloudinary,
} from "../middleware/uploadMiddleware.js";
import { Types } from "mongoose";
import { parseFormArray } from "../helpers/parseFormArray.js";
import Submission from "../models/submissionModel.js";

export const fetchMentees = async (req: Request, res: Response) => {
  try {
    const mentorId = req.mentor;
    if (!mentorId) {
      return res.status(401).json({
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
      fileLinks,
    } = req.body;

    // Basic validation
    if (!title || !date || !time || !timezone || !meetingLink) {
      return res.status(400).json({
        status: "fail",
        message: "Missing or invalid required fields",
      });
    }

    // Parse objectives
    const finalObjectives = parseFormArray<string>(objectives);

    // 1. Upload resources (if any)
    const files = (
      req.files as {
        fileAttachments?: Express.Multer.File[];
      }
    )?.fileAttachments;

    let uploadedAttachments: {
      filename: string;
      publicId: string;
      url: string;
    }[] = [];

    if (files && files.length > 0) {
      const uploads = files.map(async (file) => {
        const result = await uploadToCloudinary(
          file.buffer,
          "Enforca Sandbox/sessions",
          file.originalname,
        );

        return {
          filename: file.originalname,
          url: result.secure_url,
          publicId: result.public_id,
        };
      });

      uploadedAttachments = await Promise.all(uploads);
    }

    // Parse resourceLinks
    const linkAttachments = parseFormArray<{ filename: string; url: string }>(
      fileLinks,
    );

    const mentorCourse = await Mentor.findById(mentor).select("course");

    if (!mentorCourse?.course) {
      return res.status(404).json({
        status: "error",
        message: "Mentor course not found",
      });
    }

    let finalMentees: string[] | Types.ObjectId[] | undefined;

    if (attendees) {
      finalMentees = parseFormArray<string>(attendees);
    } else {
      const allMentees = await User.find({
        course: mentorCourse.course,
      }).select("_id");

      finalMentees = allMentees.map((m) => m._id);
    }

    const session = await Session.create({
      mentor,
      title,
      date: new Date(date),
      time,
      timezone,
      course: mentorCourse?.course,
      meetingLink,
      objectives: finalObjectives,
      attendees: finalMentees,
      notes,
      fileAttachments: uploadedAttachments,
      fileLinks: linkAttachments,
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
      return res.status(401).json({
        status: "error",
        message: "Unauthorized. Mentor not authenticated",
      });
    }

    const session = await Session.findOne({
      _id: sessionId,
      mentor,
    });

    if (!session) {
      return res.status(404).json({
        status: "error",
        message: "Session not found or not accessible",
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
      fileLinks,
      deleteAttachments,
    } = req.body;

    // 1. Delete existing resources if requested
    /* parse deleteAttachments */
    const finalDeleteAttachments = parseFormArray<string>(deleteAttachments);

    if (finalDeleteAttachments?.length) {
      const publicIdsToDelete = new Set(finalDeleteAttachments);

      // delete from cloudinary
      await Promise.all(
        [...publicIdsToDelete].map((publicId) =>
          deleteFromCloudinary(publicId),
        ),
      );

      // remove only matching attachments from mongoose DocumentArray
      for (let i = session.fileAttachments.length - 1; i >= 0; i--) {
        const att = session.fileAttachments.at(i);

        if (!att) continue;

        if (att.publicId && publicIdsToDelete.has(att.publicId)) {
          session.fileAttachments.splice(i, 1);
        }
      }
    }

    // 2. Parse objectives (same as create)
    const finalObjectives = parseFormArray<string>(objectives);

    // 3. Upload new resources (if any)
    const files = (
      req.files as {
        fileAttachments?: Express.Multer.File[];
      }
    )?.fileAttachments;

    let uploadedAttachments: {
      filename: string;
      url: string;
      publicId: string;
    }[] = [];

    if (files && files.length > 0) {
      const uploads = files.map(async (file) => {
        const result = await uploadToCloudinary(
          file.buffer,
          "Enforca Sandbox/sessions",
          file.originalname,
        );

        return {
          filename: file.originalname,
          url: result.secure_url,
          publicId: result.public_id,
        };
      });

      uploadedAttachments = await Promise.all(uploads);
    }

    // 4. Parse resourceLinks
    const linkAttachments = parseFormArray<{ filename: string; url: string }>(
      fileLinks,
    );

    // 5. Resolve mentor course + mentees
    const mentorCourse = await Mentor.findById(mentor).select("course");

    if (!mentorCourse?.course) {
      return res.status(400).json({
        status: "error",
        message: "Mentor course not found",
      });
    }

    // 6. Parse mentees
    let finalMentees: string[] | Types.ObjectId[] | undefined;

    if (attendees !== undefined) {
      finalMentees = parseFormArray<string>(attendees);
    } else {
      const allMentees = await User.find({
        course: mentorCourse.course,
      }).select("_id");

      finalMentees = allMentees.map((m) => m._id);
    }

    // 6. Update fields
    if (title !== undefined) session.title = title;
    if (notes !== undefined) session.notes = notes;
    if (date !== undefined) session.date = new Date(date);
    if (time !== undefined) session.time = time;
    if (timezone !== undefined) session.timezone = timezone;
    if (meetingLink !== undefined) session.meetingLink = meetingLink;

    if (finalObjectives !== undefined) {
      session.objectives = finalObjectives;
    }

    if (fileLinks !== undefined && linkAttachments) {
      session.fileLinks.splice(0, session.fileLinks.length); // clear existing DocumentArray

      session.fileLinks.push(...linkAttachments); // push new items
    }

    if (uploadedAttachments.length > 0) {
      session.fileAttachments.push(...uploadedAttachments);
    }

    if (finalMentees !== undefined) {
      session.attendees = finalMentees.map((id) =>
        typeof id === "string" ? new Types.ObjectId(id) : id,
      );
    }

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
      return res.status(401).json({
        status: "error",
        message: "Unauthorized. Mentor not authenticated",
      });
    }

    const session = await Session.findOne({
      _id: sessionId,
      mentor: mentorId,
    });

    if (!session) {
      return res.status(404).json({
        status: "error",
        message: "Session not found or not accessible",
      });
    }

    const deletions = session.fileAttachments.map((item) => {
      if (!item.publicId) return Promise.resolve();
      return deleteFromCloudinary(item.publicId);
    });

    await Promise.allSettled(deletions);

    await session.deleteOne();

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
      return res.status(401).json({
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
    console.log("Error rescheduling session:", error);
    return res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
};

export const addRecordingLink = async (req: Request, res: Response) => {
  try {
    const mentor = req.mentor;
    const sessionId = req.params.id;

    if (!mentor) {
      return res.status(401).json({
        status: "error",
        message: "Unauthorized. Mentor not authenticated",
      });
    }

    const { recordingLink } = req.body;

    if (!recordingLink) {
      return res.status(400).json({
        status: "error",
        message: "RecordingLink is required",
      });
    }

    const session = await Session.findOneAndUpdate(
      { _id: sessionId, mentor },
      { recordingLink },
      { new: true },
    );

    if (!session) {
      return res.status(404).json({
        status: "error",
        message: "Session not found or not accessible",
      });
    }

    return res.status(200).json({
      status: "success",
      message: "Session recording link added successfully",
    });
  } catch (error: any) {
    console.log("Error adding session recording link:", error);
    return res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
};

export const fetchAllsessions = async (req: Request, res: Response) => {
  try {
    const mentor = req.mentor;

    if (!mentor) {
      return res.status(401).json({
        status: "error",
        message: "Unauthorized. Mentor not authenticated",
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

    const sessions = await Session.find({
      mentor: mentor,
      ...dateQuery,
    })
      .populate("attendees", "firstName lastName")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      status: "success",
      data: {
        sessions,
        currentPeriod: currentPeriodLabel, // e.g., "2026-02-12" for daily
      },
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
      return res.status(401).json({
        status: "error",
        message: "Unauthorized. Mentor not authenticated",
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

    const assignments = await Assignment.find({
      mentor: mentorId,
    })
      .populate("mentees", "firstName lastName")
      .sort({
        createdAt: -1,
      });

    return res.status(200).json({
      status: "success",
      data: {
        assignments,
        currentPeriod: currentPeriodLabel,
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
      mentees,
      dueDate,
      week,
      category,
      resourceLinks,
      dueTime,
    } = req.body;

    if (!title || !description || !dueDate || !category || !dueTime) {
      return res.status(400).json({
        status: "error",
        message: "Missing required fields",
      });
    }

    // 1. Upload resources (if any)
    const files = (
      req.files as {
        resources?: Express.Multer.File[];
      }
    )?.resources;

    let uploadedResources: {
      filename: string;
      publicId: string;
      url: string;
    }[] = [];

    if (files && files.length > 0) {
      const uploads = files.map(async (file) => {
        const result = await uploadToCloudinary(
          file.buffer,
          "Enforca Sandbox/assignments",
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

    // links added from the "Add link" modal
    let linkResources: { filename: string; url: string }[] = [];

    if (resourceLinks) {
      try {
        // If it already came as an array (browser case)
        if (Array.isArray(resourceLinks)) {
          linkResources = resourceLinks;
        }
        // If it came as a string (multipart/form-data case)
        else if (typeof resourceLinks === "string") {
          linkResources = JSON.parse(resourceLinks);
        }
      } catch {
        return res.status(400).json({
          status: "error",
          message: "Invalid resourceLinks format",
        });
      }
    }

    // 2. Resolve mentor course + mentees
    const mentorCourse = await Mentor.findById(mentorId).select("course");

    if (!mentorCourse?.course) {
      return res.status(400).json({
        status: "error",
        message: "Mentor course not found",
      });
    }

    let finalMentees: string[] | Types.ObjectId[];

    if (mentees) {
      try {
        if (Array.isArray(mentees)) {
          // could be ["id1","id2"] OR ['["id1","id2"]']
          if (mentees.length === 1) {
            const maybe = JSON.parse(mentees[0]);
            finalMentees = Array.isArray(maybe) ? maybe : mentees;
          } else {
            finalMentees = mentees;
          }
        } else {
          // string
          const parsed = JSON.parse(mentees);
          finalMentees = Array.isArray(parsed) ? parsed : [parsed];
        }
      } catch {
        return res.status(400).json({
          status: "error",
          message: "Invalid mentees format",
        });
      }
    } else {
      const allMentees = await User.find({
        course: mentorCourse.course,
      }).select("_id");

      finalMentees = allMentees.map((m) => m._id);
    }

    // 3. Create assignment
    const assignment = await Assignment.create({
      mentor: mentorId,
      title,
      description,
      resourcesAttachments: uploadedResources, // ✅ uploaded files
      resourcesLinks: linkResources,
      mentees: finalMentees,
      dueDate: new Date(dueDate),
      week: category === "task" ? week : undefined,
      category,
      course: mentorCourse.course,
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
      mentees,
      dueDate,
      week,
      category,
      resourceLinks,
      dueTime,
      status,
      deleteResources,
    } = req.body;

    // 1. Delete existing resources if requested
    const finalDeleteResources = parseFormArray<string>(deleteResources);

    if (finalDeleteResources?.length) {
      const publicIdsToDelete = new Set(finalDeleteResources);

      // delete from cloudinary
      await Promise.all(
        [...publicIdsToDelete].map((publicId) =>
          deleteFromCloudinary(publicId),
        ),
      );

      // remove only matching attachments from mongoose DocumentArray
      for (let i = assignment.resourcesAttachments.length - 1; i >= 0; i--) {
        const att = assignment.resourcesAttachments.at(i);

        if (!att) continue;

        if (att.publicId && publicIdsToDelete.has(att.publicId)) {
          assignment.resourcesAttachments.splice(i, 1);
        }
      }
    }

    // 2. Upload new resources (if any)
    const files = (req.files as { resources?: Express.Multer.File[] })
      ?.resources;
    let uploadedResources: {
      filename: string;
      publicId: string;
      url: string;
    }[] = [];

    if (files && files.length > 0) {
      const uploads = files.map(async (file) => {
        const result = await uploadToCloudinary(
          file.buffer,
          "Enforca Sandbox/assignments",
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

    // 3. Parse resourceLinks

    const linkResources = parseFormArray<{ filename: string; url: string }>(
      resourceLinks,
    );

    // 4. Resolve mentor course
    const mentorCourse = await Mentor.findById(mentorId).select("course");
    if (!mentorCourse?.course) {
      return res.status(400).json({
        status: "error",
        message: "Mentor course not found",
      });
    }

    // 5. Parse mentees
    let finalMentees: string[] | Types.ObjectId[] | undefined;

    if (mentees !== undefined) {
      finalMentees = parseFormArray<string>(mentees);
    } else {
      const allMentees = await User.find({
        course: mentorCourse.course,
      }).select("_id");

      finalMentees = allMentees.map((m) => m._id);
    }

    // 6. Update assignment fields
    if (title) assignment.title = title;
    if (description) assignment.description = description;
    if (dueDate) assignment.dueDate = new Date(dueDate);
    if (dueTime) assignment.dueTime = dueTime;
    if (category) assignment.category = category;
    if (week && category === "task") assignment.week = week;
    if (status) assignment.status = status;

    if (finalMentees !== undefined) {
      assignment.mentees = finalMentees.map((id) =>
        typeof id === "string" ? new Types.ObjectId(id) : id,
      );
    }

    if (resourceLinks !== undefined && linkResources) {
      assignment.resourcesLinks.splice(0, assignment.resourcesLinks.length); // clear existing DocumentArray

      assignment.resourcesLinks.push(...linkResources); // push new items
    }

    if (uploadedResources.length > 0) {
      assignment.resourcesAttachments.push(...uploadedResources);
    }

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

    const deletions = assignment.resourcesAttachments.map((item) => {
      if (!item.publicId) return Promise.resolve();
      return deleteFromCloudinary(item.publicId);
    });

    await Promise.allSettled(deletions);

    await assignment.deleteOne();

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

export const getAllSubmissions = async (req: Request, res: Response) => {
  try {
    const mentorId = req.mentor;
    if (!mentorId) {
      return res.status(401).json({
        status: "error",
        message: "Unauthorized. Mentor not authenticated",
      });
    }

    const submissions = await Submission.find({
      mentor: mentorId,
    })
      .populate("assignment", "description week")
      .populate("mentee", "firstName lastName email profilePhoto")
      .sort({ createdAt: -1 });

    if (!submissions) {
      return res.status(400).json({
        status: "error",
        message: "No submissions found for this mentor",
      });
    }

    return res.status(200).json({
      status: "success",
      data: submissions,
    });
  } catch (error: any) {
    console.error("Fetch submissions error:", error);

    return res.status(500).json({
      status: "error",
      message: "Failed to fetch submissions",
      error: error.message,
    });
  }
};

export const gradeSubmission = async (req: Request, res: Response) => {
  try {
    const mentor = req.mentor;
    if (!mentor) {
      return res.status(401).json({
        status: "error",
        message: "Unauthorized. Mentor not authenticated",
      });
    }

    const submissionId = req.params.id;

    const { gradeScore, feedback } = req.body;

    if (gradeScore == null || !feedback) {
      return res.status(400).json({
        status: "error",
        message: "sessionId, gradeScore and feedback are required",
      });
    }

    const submission = await Submission.findOneAndUpdate(
      { _id: submissionId, mentor }, // 🔐 ownership check
      {
        grade: gradeScore,
        mentorFeedback: feedback,
        gradeDate: new Date(),
      },
      { new: true },
    );
    if (!submission) {
      return res.status(404).json({
        status: "error",
        message: "Mentor course not found",
      });
    }

    return res.status(200).json({
      status: "success",
      data: submission,
    });
  } catch (error: any) {
    console.log("Error grading submission:", error);
    return res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
};
