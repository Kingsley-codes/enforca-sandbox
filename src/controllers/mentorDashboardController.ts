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
import {
  deleteFromCloudinary,
  uploadToCloudinary,
} from "../middleware/uploadMiddleware.js";
import { Types } from "mongoose";

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
      fileLinks,
    } = req.body;

    // Basic validation
    if (!title || !date || !time || !timezone || !meetingLink) {
      return res.status(400).json({
        status: "fail",
        message: "Missing or invalid required fields",
      });
    }

    let finalObjectives: string[] = [];

    if (objectives) {
      try {
        if (Array.isArray(objectives)) {
          // could be ["text1", "text2"] OR ['["text1","text2"]']
          if (objectives.length === 1 && typeof objectives[0] === "string") {
            const maybe = JSON.parse(objectives[0]);
            finalObjectives = Array.isArray(maybe)
              ? maybe
              : (objectives as string[]);
          } else {
            finalObjectives = objectives as string[];
          }
        } else if (typeof objectives === "string") {
          const parsed = JSON.parse(objectives);
          finalObjectives = Array.isArray(parsed) ? parsed : [parsed];
        }
      } catch {
        return res.status(400).json({
          status: "error",
          message: "Invalid objectives format",
        });
      }
    }

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
        );

        return {
          filename: file.originalname,
          url: result.secure_url,
          publicId: result.public_id,
        };
      });

      uploadedAttachments = await Promise.all(uploads);
    }

    // links added from the "Add link" modal
    let linkAttachments: { filename: string; url: string }[] = [];

    if (fileLinks) {
      try {
        // If it already came as an array (browser case)
        if (Array.isArray(fileLinks)) {
          linkAttachments = fileLinks;
        }
        // If it came as a string (multipart/form-data case)
        else if (typeof fileLinks === "string") {
          linkAttachments = JSON.parse(fileLinks);
        }
      } catch {
        return res.status(400).json({
          status: "error",
          message: "Invalid fileLinks format",
        });
      }
    }

    const mentorCourse = await Mentor.findById(mentor).select("course");

    if (!mentorCourse?.course) {
      return res.status(400).json({
        status: "error",
        message: "Mentor course not found",
      });
    }

    let finalMentees: string[] | Types.ObjectId[];

    if (attendees) {
      try {
        if (Array.isArray(attendees)) {
          // could be ["id1","id2"] OR ['["id1","id2"]']
          if (attendees.length === 1) {
            const maybe = JSON.parse(attendees[0]);
            finalMentees = Array.isArray(maybe) ? maybe : attendees;
          } else {
            finalMentees = attendees;
          }
        } else {
          // string
          const parsed = JSON.parse(attendees);
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
      fileAttachments: [...uploadedAttachments, ...linkAttachments],
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

    const rawDelete = deleteAttachments;

    const deleteExistingAttachments =
      rawDelete === true || rawDelete === "true";

    // 1. Delete existing resources if requested
    if (deleteExistingAttachments && session.fileAttachments.length > 0) {
      const deletions = session.fileAttachments.map(async (resItem) => {
        if (!resItem.publicId) return;

        await deleteFromCloudinary(resItem.publicId);
      });

      await Promise.all(deletions);

      // clear mongoose DocumentArray properly
      session.fileAttachments.splice(0);
    }

    // 2. Parse objectives (same as create)
    let finalObjectives: string[] | undefined;

    if (objectives !== undefined) {
      try {
        if (Array.isArray(objectives)) {
          if (objectives.length === 1 && typeof objectives[0] === "string") {
            const maybe = JSON.parse(objectives[0]);
            finalObjectives = Array.isArray(maybe)
              ? maybe
              : (objectives as string[]);
          } else {
            finalObjectives = objectives as string[];
          }
        } else if (typeof objectives === "string") {
          const parsed = JSON.parse(objectives);
          finalObjectives = Array.isArray(parsed) ? parsed : [parsed];
        }
      } catch {
        return res.status(400).json({
          status: "error",
          message: "Invalid objectives format",
        });
      }
    }

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
    let linkAttachments: { filename: string; url: string }[] = [];

    if (fileLinks !== undefined) {
      try {
        if (Array.isArray(fileLinks)) {
          linkAttachments = fileLinks;
        } else if (typeof fileLinks === "string") {
          linkAttachments = JSON.parse(fileLinks);
        }
      } catch {
        return res.status(400).json({
          status: "error",
          message: "Invalid fileLinks format",
        });
      }
    }

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
      try {
        if (Array.isArray(attendees)) {
          if (attendees.length === 1) {
            const maybe = JSON.parse(attendees[0]);
            finalMentees = Array.isArray(maybe) ? maybe : attendees;
          } else {
            finalMentees = attendees;
          }
        } else {
          const parsed = JSON.parse(attendees);
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

    session.attendees = finalMentees.map((id) =>
      typeof id === "string" ? new Types.ObjectId(id) : id,
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
    console.log("Error rescheduling session:", error);
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
      return res.status(400).json({
        status: "error",
        message: "Unauthorized. Mentor not authenticated",
      });
    }

    const dateFilter = buildSessionTimezoneMatch(
      req.query.filter as DateFilter,
    );

    const pipeline: any[] = [{ $match: { mentor } }];

    if (dateFilter) {
      pipeline.push({ $match: dateFilter });
    }

    const sessions = await Session.aggregate(pipeline);

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
      resources: [...uploadedResources, ...linkResources], // ✅ uploaded files
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
      deleteResources, // new boolean flag
    } = req.body;

    const rawDelete = deleteResources;

    const deleteExistingResources = rawDelete === true || rawDelete === "true";

    // 1. Delete existing resources if requested
    if (deleteExistingResources && assignment.resources.length > 0) {
      const deletions = assignment.resources.map(async (resItem) => {
        if (!resItem.publicId) return;

        await deleteFromCloudinary(resItem.publicId);
      });

      await Promise.all(deletions);

      // clear mongoose DocumentArray properly
      assignment.resources.splice(0);
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

    // 4. Resolve mentor course
    const mentorCourse = await Mentor.findById(mentorId).select("course");
    if (!mentorCourse?.course) {
      return res.status(400).json({
        status: "error",
        message: "Mentor course not found",
      });
    }

    // 5. Parse mentees
    let finalMentees: string[] | Types.ObjectId[] = assignment.mentees;
    if (mentees) {
      try {
        if (Array.isArray(mentees)) {
          if (mentees.length === 1) {
            const maybe = JSON.parse(mentees[0]);
            finalMentees = Array.isArray(maybe) ? maybe : mentees;
          } else {
            finalMentees = mentees;
          }
        } else {
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

    // 6. Update assignment fields
    if (title) assignment.title = title;
    if (description) assignment.description = description;
    if (dueDate) assignment.dueDate = new Date(dueDate);
    if (dueTime) assignment.dueTime = dueTime;
    if (category) assignment.category = category;
    if (week && category === "task") assignment.week = week;
    if (status) assignment.status = status;
    assignment.mentees = finalMentees.map((id) =>
      typeof id === "string" ? new Types.ObjectId(id) : id,
    );

    // 7. Set new resources (replacing old ones if deleted)
    assignment.resources.push(...uploadedResources, ...linkResources);

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
