import { Request, Response } from "express";
import User from "../models/userModel.js";
import Mentor from "../models/mentorModel.js";

// export const purchaseOverview = async (req: Request, res: Response) => {
//   try {
//     const adminId = req.admin;

//     if (!adminId) {
//       return res.status(401).json({
//         status: "error",
//         message: "Unauthorized. Admin not authenticated",
//       });
//     }
//   } catch (error: any) {}
// };

export const fetchAllMentees = async (req: Request, res: Response) => {
  try {
    const adminId = req.admin;

    if (!adminId) {
      return res.status(401).json({
        status: "error",
        message: "Unauthorized. Admin not authenticated",
      });
    }

    const { assignedStatus, page = 1 } = req.query;

    const limit = 10;
    const currentPage = Number(page);
    const skip = (currentPage - 1) * limit;

    const filter: any = {};

    if (assignedStatus) {
      filter.assignedStatus = assignedStatus;
    }

    const [
      mentees,
      totalMentees,
      assignedMentees,
      unassignedMentees,
      filteredCount,
    ] = await Promise.all([
      User.find(filter)
        .select(
          "firstName lastName email assignedStatus course trainer createdAt",
        )
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),

      User.countDocuments(),
      User.countDocuments({ assignedStatus: "assigned" }),
      User.countDocuments({ assignedStatus: "unassigned" }),
      User.countDocuments(filter),
    ]);

    return res.status(200).json({
      status: "success",
      stats: {
        totalMentees,
        assignedMentees,
        unassignedMentees,
      },
      pagination: {
        totalFiltered: filteredCount,
        currentPage,
        totalPages: Math.ceil(filteredCount / limit),
        limit,
      },
      data: {
        mentees,
      },
    });
  } catch (error: any) {
    console.log("Error fetching all mentees:", error);

    return res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
};

export const assignMenteeTrainer = async (req: Request, res: Response) => {
  try {
    const adminId = req.admin;

    if (!adminId) {
      return res.status(401).json({
        status: "error",
        message: "Unauthorized. Admin not authenticated",
      });
    }

    const { menteeId, mentorId } = req.body;

    const existingUser = await User.findById(menteeId);
    const mentor = await Mentor.findById(mentorId);

    if (!existingUser) {
      return res.status(404).json({
        status: "error",
        message: "Mentee not found",
      });
    }

    if (!mentor) {
      return res.status(404).json({
        status: "error",
        message: "Mentor not found",
      });
    }

    if (existingUser.course !== mentor.course) {
      return res.status(400).json({
        status: "error",
        message: "Mentor and mentee must belong to the same course",
      });
    }

    await Mentor.findByIdAndUpdate(
      mentorId,
      { $push: { mentees: menteeId } },
      { new: true },
    );

    existingUser.trainer = `${mentor.firstName} ${mentor.lastName}`;
    existingUser.assignedStatus = "assigned";
    await existingUser.save();

    return res.status(200).json({
      status: "success",
      message: "Mentee successfully assigned to mentor",
    });
  } catch (error: any) {
    console.log("Error assigning mentee to mentor:", error);
    return res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
};

export const changeMenteeTrainer = async (req: Request, res: Response) => {
  try {
    const adminId = req.admin;

    if (!adminId) {
      return res.status(401).json({
        status: "error",
        message: "Unauthorized. Admin not authenticated",
      });
    }

    const { menteeId, newMentorId } = req.body;

    const mentee = await User.findById(menteeId);

    if (!mentee) {
      return res.status(404).json({
        status: "error",
        message: "Mentee not found",
      });
    }

    const newMentor = await Mentor.findById(newMentorId);

    if (!newMentor) {
      return res.status(404).json({
        status: "error",
        message: "New mentor not found",
      });
    }

    // Ensure course match
    if (mentee.course !== newMentor.course) {
      return res.status(400).json({
        status: "error",
        message: "Mentor and mentee must belong to the same course",
      });
    }

    // Remove mentee from any mentor that currently has them
    await Mentor.updateMany(
      { mentees: menteeId },
      { $pull: { mentees: menteeId } },
    );

    // Add mentee to new mentor
    await Mentor.findByIdAndUpdate(newMentorId, {
      $push: { mentees: menteeId },
    });

    // Update mentee record
    mentee.trainer = `${newMentor.firstName} ${newMentor.lastName}`;
    mentee.assignedStatus = "assigned";

    await mentee.save();

    return res.status(200).json({
      status: "success",
      message: "Mentee successfully transferred to new mentor",
    });
  } catch (error: any) {
    console.log("Error changing mentee mentor:", error);

    return res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
};

export const fetchMentors = async (req: Request, res: Response) => {
  try {
    const adminId = req.admin;

    if (!adminId) {
      return res.status(401).json({
        status: "error",
        message: "Unauthorized. Admin not authenticated",
      });
    }

    const { course } = req.params;

    const mentors = await Mentor.find({ course: course });

    return res.status(200).json({
      status: "success",
      data: mentors,
    });
  } catch (error: any) {
    console.log("Error fetch mentors:", error);

    return res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
};
