import { Request, Response } from "express";
import Session from "../models/sessionModel.js";
import Assignment from "../models/assignmentModel.js";
import { DateFilterType, getDateRange } from "../helpers/filter.js";
import Submission from "../models/submissionModel.js";
import { uploadToCloudinary } from "../middleware/uploadMiddleware.js";

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

    const assignments = await Assignment.find({
      mentees: menteeId,
      ...dateQuery,
    })
      .select("-mentor -mentees")
      .sort({ createdAt: -1 });

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

export const fetchMySessions = async (req: Request, res: Response) => {
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

    const session = await Session.find({
      attendees: menteeId,
      ...dateQuery,
    })
      .select("-mentor -attendees")
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

export const makeSubmission = async (req: Request, res: Response) => {
  try {
    const menteeId = req.user;

    if (!menteeId) {
      return res.status(400).json({
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

    const assignment = await Assignment.findById(assignmentId);

    if (!assignment) {
      return res.status(404).json({
        status: "error",
        message: "Assignment not found or not accessible",
      });
    }

    const existingSubmission = await Submission.find({
      assignment: assignmentId,
      mentee: menteeId,
    });

    if (existingSubmission) {
      return res.status(409).json({
        status: "error",
        message: "Assignment already submitted for this user",
      });
    }

    // links added from the "Add link" modal
    let linkResources: { filename: string; url: string }[] = [];

    if (submittedLinks) {
      try {
        // If it already came as an array (browser case)
        if (Array.isArray(submittedLinks)) {
          linkResources = submittedLinks;
        }
        // If it came as a string (multipart/form-data case)
        else if (typeof submittedLinks === "string") {
          linkResources = JSON.parse(submittedLinks);
        }
      } catch {
        return res.status(400).json({
          status: "error",
          message: "Invalid submittedLinks format",
        });
      }
    }

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

    return res.status(201).json({
      status: "success",
      data: {
        newSubmission,
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
