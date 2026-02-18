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

    const mentor = await Mentor.findById(mentorId).select("course");

    if (!mentor) {
      return res.status(404).json({
        status: "error",
        message: "Mentor not found",
      });
    }

    const mentees = await User.aggregate([
      /* Only mentees in this mentor's course */
      {
        $match: {
          course: mentor.course,
        },
      },

      /* Count attended sessions
         (from mentor_sessions collection) */
      {
        $lookup: {
          from: "mentor_sessions",
          let: { menteeId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: { $in: ["$$menteeId", "$attendees"] },
              },
            },
            {
              $count: "totalSessions",
            },
          ],
          as: "sessionStats",
        },
      },

      /* Count submitted tasks */
      {
        $lookup: {
          from: "assignments",
          let: { menteeId: "$_id" },
          pipeline: [
            {
              $match: { category: "task" },
            },
            { $unwind: "$mentees" },
            {
              $match: {
                $expr: { $eq: ["$mentees.user", "$$menteeId"] },
              },
            },
            {
              $group: {
                _id: null,
                totalTasks: { $sum: 1 },

                pendingTasks: {
                  $sum: {
                    $cond: [{ $eq: ["$mentees.status", "assigned"] }, 1, 0],
                  },
                },

                submittedTasks: {
                  $sum: {
                    $cond: [{ $eq: ["$mentees.status", "submitted"] }, 1, 0],
                  },
                },

                overdueTasks: {
                  $sum: {
                    $cond: [{ $eq: ["$mentees.status", "overdue"] }, 1, 0],
                  },
                },
              },
            },
          ],
          as: "taskStats",
        },
      },

      /* ------------------------------------
         Flatten lookup results
      ------------------------------------- */
      {
        $set: {
          taskStats: {
            $ifNull: [
              { $first: "$taskStats" },
              {
                totalTasks: 0,
                pendingTasks: 0,
                submittedTasks: 0,
                overdueTasks: 0,
              },
            ],
          },
        },
      },
      {
        $set: {
          totalTasks: "$taskStats.totalTasks",
          pendingTasks: "$taskStats.pendingTasks",
          submittedTasks: "$taskStats.submittedTasks",
          overdueTasks: "$taskStats.overdueTasks",
        },
      },
      {
        $unset: "taskStats",
      },

      {
        $set: {
          sessionStats: {
            $ifNull: [{ $first: "$sessionStats" }, { totalSessions: 0 }],
          },
        },
      },
      {
        $set: {
          totalSessions: "$sessionStats.totalSessions",
        },
      },
      {
        $unset: "sessionStats",
      },

      {
        $set: {
          avrAttendance: {
            $cond: [
              { $gt: ["$totalSessions", 0] },
              {
                $multiply: [
                  { $divide: ["$totalAttendance", "$totalSessions"] },
                  100,
                ],
              },
              0,
            ],
          },
          missedAttendance: {
            $max: [{ $subtract: ["$totalSessions", "$totalAttendance"] }, 0],
          },
        },
      },

      /* ------------------------------------
         Only return what you need
      ------------------------------------- */
      {
        $project: {
          firstName: 1,
          lastName: 1,
          email: 1,
          course: 1,
          profilePhoto: 1,
          about: 1,
          totalAttendance: 1,
          aveGrade: 1,
          avrAttendance: 1,
          missedAttendance: 1,
          totalTasks: 1,
          pendingTasks: 1,
          submittedTasks: 1,
          overdueTasks: 1,
        },
      },
    ]);

    if (!mentees.length) {
      return res.status(404).json({
        status: "error",
        message: "No mentees found for this mentor",
      });
    }

    return res.status(200).json({
      status: "success",
      data: {
        menteesCount: mentees.length,
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

    // 👉 populate users with this session
    await User.updateMany(
      {
        _id: { $in: finalMentees },
      },
      {
        $push: {
          sessions: {
            session: session._id,
            title: session.title,
            date: session.date,
          },
        },
      },
    );

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
    const { id: sessionId } = req.params;

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

    // old list (before save)
    const oldAttendees = session.attendees.map(
      (id: any) => new Types.ObjectId(id),
    );

    // normalize new list
    const newAttendees = finalMentees
      ? finalMentees.map((id) =>
          typeof id === "string" ? new Types.ObjectId(id) : id,
        )
      : session.attendees;

    // helper sets
    const newSet = new Set(newAttendees.map((i) => i.toString()));
    const oldSet = new Set(oldAttendees.map((i) => i.toString()));

    const removed = [...oldSet].filter((id) => !newSet.has(id));
    const added = [...newSet].filter((id) => !oldSet.has(id));

    // 1. remove session from removed users
    if (removed.length) {
      await User.updateMany(
        { _id: { $in: removed.map((id) => new Types.ObjectId(id)) } },
        {
          $pull: {
            sessions: { session: session._id },
          },
        },
      );
    }

    // 2. add session to newly added users
    if (added.length) {
      await User.updateMany(
        { _id: { $in: added.map((id) => new Types.ObjectId(id)) } },
        {
          $push: {
            sessions: {
              session: session._id,
              title: title ?? session.title,
              date: date ? new Date(date) : session.date,
              attended: false,
            },
          },
        },
      );
    }

    // 3. update title/date for users that still have the session
    await User.updateMany(
      {
        _id: { $in: newAttendees },
        "sessions.session": session._id,
      },
      {
        $set: {
          "sessions.$.title": title ?? session.title,
          "sessions.$.date": date ? new Date(date) : session.date,
        },
      },
    );

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
    const { id: sessionId } = req.params;

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
    const { id: sessionId } = req.params;

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
    const { id: sessionId } = req.params;

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
      {
        recordingLink,
        recordingAvailable: true,
      },
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
    const linkResources = parseFormArray<{ filename: string; url: string }>(
      resourceLinks,
    );

    // 2. Resolve mentor course + mentees
    const mentorCourse = await Mentor.findById(mentorId).select("course");

    if (!mentorCourse?.course) {
      return res.status(400).json({
        status: "error",
        message: "Mentor course not found",
      });
    }

    let finalMentees: { user: Types.ObjectId; status: "assigned" }[];

    if (mentees) {
      const menteeIds = parseFormArray<string>(mentees) ?? [];

      finalMentees = menteeIds.map((id) => ({
        user: new Types.ObjectId(id),
        status: "assigned",
      }));
    } else {
      const allMentees = await User.find({
        course: mentorCourse.course,
      }).select("_id");

      finalMentees = allMentees.map((m) => ({
        user: m._id,
        status: "assigned",
      }));
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
    const { id: assignmentId } = req.params;

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
    let finalMentees: {
      user: Types.ObjectId;
      status: "assigned" | "submitted" | "graded" | "overdue";
    }[];

    if (mentees !== undefined) {
      const existingMap = new Map(
        assignment.mentees.map((m) => [m.user.toString(), m.status]),
      );

      const menteeIds = parseFormArray<string>(mentees) ?? [];

      finalMentees = menteeIds.map((id) => ({
        user: new Types.ObjectId(id),
        status: existingMap.get(id) ?? "assigned",
      }));
    } else {
      const allMentees = await User.find({
        course: mentorCourse.course,
      }).select("_id");

      const existingMap = new Map(
        assignment.mentees.map((m) => [m.user.toString(), m.status]),
      );

      finalMentees = allMentees.map((m) => ({
        user: m._id,
        status: existingMap.get(m._id.toString()) ?? "assigned",
      }));
    }

    // 6. Update assignment fields
    if (title) assignment.title = title;
    if (description) assignment.description = description;
    if (dueDate) assignment.dueDate = new Date(dueDate);
    if (dueTime) assignment.dueTime = dueTime;
    if (category) assignment.category = category;
    if (week && category === "task") assignment.week = week;

    if (mentees !== undefined) {
      assignment.mentees.splice(0, assignment.mentees.length);
      assignment.mentees.push(...finalMentees);
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
    const { id: assignmentId } = req.params;

    if (!mentorId) {
      return res.status(401).json({
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

    const { id: submissionId } = req.params;

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
        status: "graded",
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

    await Assignment.updateOne(
      {
        _id: submission.assignment,
        "mentees.user": submission.mentee,
      },
      {
        $set: {
          "mentees.$.status": "submitted",
        },
      },
    );

    const result = await Submission.aggregate([
      {
        $match: {
          mentee: submission.mentee,
          status: "graded",
          grade: { $ne: null },
        },
      },
      {
        $group: {
          _id: "$mentee",
          avgGrade: { $avg: "$grade" },
        },
      },
    ]);

    const avgGrade =
      result.length > 0 ? Number(result[0].avgGrade.toFixed(2)) : null;

    if (avgGrade !== null) {
      await User.findByIdAndUpdate(submission.mentee, {
        aveGrade: avgGrade,
      });
    }

    return res.status(200).json({
      status: "success",
      data: submission,
      aveGrade: avgGrade,
    });
  } catch (error: any) {
    console.log("Error grading submission:", error);
    return res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
};

export const fetchMenteeAssignments = async (req: Request, res: Response) => {
  try {
    const mentor = req.mentor;

    if (!mentor) {
      return res.status(401).json({
        status: "error",
        message: "Unauthorized. Mentor not authenticated",
      });
    }

    const menteeId = req.params.id as string;

    const { filterType, referenceDate, offset } = req.query as {
      filterType?: DateFilterType;
      referenceDate?: string;
      offset?: string;
    };

    let dateMatch: any = {};
    let currentPeriodLabel: string | null = null;

    if (filterType) {
      const { start, end } = getDateRange(
        filterType,
        referenceDate ? new Date(referenceDate) : undefined,
        offset ? parseInt(offset) : 0,
      );

      dateMatch = {
        dueDate: { $gte: start, $lte: end },
      };

      currentPeriodLabel =
        filterType === "day"
          ? start.toISOString().slice(0, 10)
          : filterType === "week"
            ? `${start.toISOString().slice(0, 10)} to ${end
                .toISOString()
                .slice(0, 10)}`
            : start.toLocaleString("default", {
                month: "long",
                year: "numeric",
              });
    }

    const assignments = await Assignment.aggregate([
      {
        $match: {
          mentor: mentor,
          category: "task",
          "mentees.user": new Types.ObjectId(menteeId),
          ...dateMatch,
        },
      },

      // keep only this mentee in the mentees array
      {
        $addFields: {
          mentees: {
            $filter: {
              input: "$mentees",
              as: "m",
              cond: {
                $eq: ["$$m.user", new Types.ObjectId(menteeId)],
              },
            },
          },
        },
      },

      // join submissions
      {
        $lookup: {
          from: "submissions",
          let: { assignmentId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$assignment", "$$assignmentId"] },
                    { $eq: ["$mentee", new Types.ObjectId(menteeId)] },
                    { $eq: ["$status", "graded"] },
                  ],
                },
              },
            },
            {
              $project: {
                grade: 1,
                gradeDate: 1,
                mentorFeedback: 1,
                _id: 0,
              },
            },
          ],
          as: "submission",
        },
      },

      // flatten submission (0 or 1)
      {
        $addFields: {
          submission: { $arrayElemAt: ["$submission", 0] },
        },
      },

      {
        $sort: { createdAt: -1 },
      },

      {
        $project: {
          mentor: 0,
        },
      },
    ]);

    return res.status(200).json({
      status: "success",
      data: {
        assignments,
        currentPeriod: currentPeriodLabel,
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

export const fetchMentorProjects = async (req: Request, res: Response) => {
  try {
    const mentor = req.mentor;

    if (!mentor) {
      return res.status(401).json({
        status: "error",
        message: "Unauthorized. Mentor not authenticated",
      });
    }

    const menteeId = req.params.id as string;

    const mentee = await User.findById(menteeId);

    if (!mentee) {
      return res.status(404).json({
        status: "error",
        message: "Mentee not found",
      });
    }

    const projects = await Assignment.aggregate([
      {
        $match: {
          mentor: mentor,
          category: "project",
          "mentees.user": new Types.ObjectId(menteeId),
        },
      },

      // keep only this mentee in the mentees array
      {
        $addFields: {
          mentees: {
            $filter: {
              input: "$mentees",
              as: "m",
              cond: {
                $eq: ["$$m.user", new Types.ObjectId(menteeId)],
              },
            },
          },
        },
      },

      // join submissions
      {
        $lookup: {
          from: "submissions",
          let: { assignmentId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$assignment", "$$assignmentId"] },
                    { $eq: ["$mentee", new Types.ObjectId(menteeId)] },
                    { $eq: ["$status", "graded"] },
                  ],
                },
              },
            },
            {
              $project: {
                grade: 1,
                gradeDate: 1,
                mentorFeedback: 1,
                _id: 0,
              },
            },
          ],
          as: "submission",
        },
      },

      // flatten submission (0 or 1)
      {
        $addFields: {
          submission: { $arrayElemAt: ["$submission", 0] },
        },
      },

      {
        $sort: { createdAt: -1 },
      },

      {
        $project: {
          mentor: 0,
        },
      },
    ]);

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

export const fetchMenteesList = async (req: Request, res: Response) => {
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
      "firstName lastName",
    );

    if (!mentees || mentees.length === 0) {
      return res.status(404).json({
        status: "error",
        message: "No mentees found for this mentor",
      });
    }

    return res.status(200).json({
      status: "success",
      data: {
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
