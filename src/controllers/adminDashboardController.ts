import { Request, Response } from "express";
import User from "../models/userModel.js";
import Mentor from "../models/mentorModel.js";
import Payment from "../models/paymentModel.js";
import { buildAdminDateFilter } from "../helpers/filter.js";

export const purchaseOverview = async (req: Request, res: Response) => {
  try {
    const adminId = req.admin;

    if (!adminId) {
      return res.status(401).json({
        status: "error",
        message: "Unauthorized. Admin not authenticated",
      });
    }

    const { q, page = 1 } = req.query;

    const limit = 10;
    const currentPage = Number(page);
    const skip = (currentPage - 1) * limit;

    const searchFilter: any = {};

    if (q) {
      searchFilter.$or = [
        { firstName: { $regex: q, $options: "i" } },
        { lastName: { $regex: q, $options: "i" } },
        { email: { $regex: q, $options: "i" } },
      ];
    }

    const payments = await Payment.find({ paymentStatus: "Completed" })
      .populate({
        path: "mentee",
        select: "firstName lastName email unusedCoins totalCoinsSpent course",
        match: q ? searchFilter : {},
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    // Remove payments where mentee didn't match search
    const filteredPayments = payments.filter((p) => p.mentee);

    const totalRevenue = filteredPayments.reduce(
      (sum, payment) => sum + payment.amount,
      0,
    );

    const totalCoins = filteredPayments.reduce(
      (sum, payment) => sum + (payment.coinsAmount || 0),
      0,
    );

    const totalPayments = await Payment.countDocuments({
      paymentStatus: "Completed",
    });

    return res.status(200).json({
      status: "success",
      results: filteredPayments.length,
      pagination: {
        total: totalPayments,
        page: currentPage,
        pages: Math.ceil(totalPayments / limit),
      },
      data: {
        totalRevenue,
        totalCoins,
        payments: filteredPayments,
      },
    });
  } catch (error: any) {
    console.log("Error fetching purchase overview:", error);

    return res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
};

export const fetchAllMentees = async (req: Request, res: Response) => {
  try {
    const adminId = req.admin;

    if (!adminId) {
      return res.status(401).json({
        status: "error",
        message: "Unauthorized. Admin not authenticated",
      });
    }

    const {
      q,
      assignedStatus,
      course,
      isPremium,
      status,
      page = 1,
    } = req.query;

    const limit = 10;
    const currentPage = Number(page);
    const skip = (currentPage - 1) * limit;

    const filter: any = {};

    if (assignedStatus) {
      filter.assignedStatus = assignedStatus;
    }

    if (course) {
      filter.course = course;
    }

    if (isPremium) {
      filter.isPremium = isPremium === "true";
    }

    if (status) {
      filter.status = status;
    }

    if (q) {
      filter.$or = [
        { firstName: { $regex: q, $options: "i" } },
        { lastName: { $regex: q, $options: "i" } },
        { email: { $regex: q, $options: "i" } },
      ];
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
          "firstName lastName email assignedStatus status isPremium totalCoinsSpent unusedCoins course trainer createdAt",
        )
        .populate("trainer", "firstName lastName")
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

    const { mentees, mentorId } = req.body;

    if (!Array.isArray(mentees) || mentees.length === 0) {
      return res.status(400).json({
        status: "error",
        message: "menteeIds must be a non-empty array",
      });
    }

    const mentor = await Mentor.findById(mentorId);

    if (!mentor) {
      return res.status(404).json({
        status: "error",
        message: "Mentor not found",
      });
    }

    // Fetch all mentees
    const allMentees = await User.find({ _id: { $in: mentees } });

    if (allMentees.length !== mentees.length) {
      return res.status(404).json({
        status: "error",
        message: "One or more mentees not found",
      });
    }

    // Ensure all mentees belong to same course as mentor
    const invalidMentees = allMentees.filter(
      (mentee) => mentee.course !== mentor.course,
    );

    if (invalidMentees.length > 0) {
      return res.status(400).json({
        status: "error",
        message: "All mentees must belong to the same course as the mentor",
      });
    }

    // Update mentor (avoid duplicates with $addToSet)
    await Mentor.findByIdAndUpdate(mentorId, {
      $addToSet: { mentees: { $each: mentees } },
    });

    // Update all mentees
    await User.updateMany(
      { _id: { $in: mentees } },
      {
        $set: {
          trainer: mentorId,
          assignedStatus: "assigned",
        },
      },
    );

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
    mentee.trainer = newMentorId;
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

    const { course } = req.query;

    const filter: any = {};

    if (course) {
      filter.course = course;
    }

    const mentors = await Mentor.find(filter).select("-password");

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

export const fetchMenteesSessions = async (req: Request, res: Response) => {
  try {
    const adminId = req.admin;
    if (!adminId) {
      return res.status(401).json({
        status: "error",
        message: "Unauthorized. Admin not authenticated",
      });
    }

    const { q, course, page = 1 } = req.query;

    const limit = 10;
    const currentPage = Number(page);
    const skip = (currentPage - 1) * limit;

    const filter: any = {};

    if (course) {
      filter.course = course;
    }

    if (q) {
      filter.$or = [
        { firstName: { $regex: q, $options: "i" } },
        { lastName: { $regex: q, $options: "i" } },
        { email: { $regex: q, $options: "i" } },
      ];
    }

    const mentees = await User.find(filter)
      .select("firstName lastName email sessions")
      .skip(skip)
      .limit(limit);

    const menteesWithCounts = mentees.map((mentee) => {
      const sessions = mentee.sessions || [];

      const totalSessions = sessions.length;
      const attendedSessions = sessions.filter(
        (s) => s.attendance === "attended",
      ).length;

      const missedSessions = sessions.filter(
        (s) => s.attendance === "missed",
      ).length;

      return {
        _id: mentee._id,
        firstName: mentee.firstName,
        lastName: mentee.lastName,
        email: mentee.email,
        sessions,
        counts: {
          totalSessions,
          attendedSessions,
          missedSessions,
        },
      };
    });

    const totalMentees = await User.countDocuments(filter);

    return res.status(200).json({
      status: "success",
      results: menteesWithCounts.length,
      pagination: {
        total: totalMentees,
        page: currentPage,
        pages: Math.ceil(totalMentees / limit),
      },
      data: menteesWithCounts,
    });
  } catch (error: any) {
    console.log("Error fetching mentee sessions:", error);
    return res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
};

export const fetchLowCoinMentees = async (req: Request, res: Response) => {
  try {
    const adminId = req.admin;

    if (!adminId) {
      return res.status(401).json({
        status: "error",
        message: "Unauthorized. Admin not authenticated",
      });
    }

    const filter = {
      unusedCoins: { $lt: 500 },
    };

    const users = await User.find(filter)
      .select("firstName lastName email unusedCoins course")
      .sort({ unusedCoins: 1 }); // lowest coins first

    const totalUsers = await User.countDocuments(filter);

    return res.status(200).json({
      status: "success",
      results: users.length,
      pagination: {
        total: totalUsers,
      },
      data: users,
    });
  } catch (error: any) {
    console.log("Error fetching low coin users:", error);

    return res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
};

export const transactionHistory = async (req: Request, res: Response) => {
  try {
    const adminId = req.admin;

    if (!adminId) {
      return res.status(401).json({
        status: "error",
        message: "Unauthorized",
      });
    }

    const { q, date, startDate, endDate, page = 1 } = req.query as any;

    const limit = 10;
    const skip = (Number(page) - 1) * limit;

    const match: any = {
      paymentStatus: "Completed",
    };

    // Apply date filter using helper
    if (date) {
      const dateRange = buildAdminDateFilter(date, startDate, endDate);
      if (Object.keys(dateRange).length) {
        match.createdAt = dateRange;
      }
    }

    const pipeline: any[] = [
      { $match: match },

      {
        $lookup: {
          from: "users",
          localField: "mentee",
          foreignField: "_id",
          as: "user",
        },
      },

      { $unwind: "$user" },
    ];

    // Search filter
    if (q) {
      pipeline.push({
        $match: {
          $or: [
            { "user.firstName": { $regex: q, $options: "i" } },
            { "user.lastName": { $regex: q, $options: "i" } },
            { "user.email": { $regex: q, $options: "i" } },
          ],
        },
      });
    }

    // Stats + transactions
    pipeline.push({
      $facet: {
        stats: [
          {
            $group: {
              _id: null,
              totalTransactions: { $sum: 1 },
              totalRevenue: { $sum: "$amount" },
              totalCoinsBought: { $sum: { $ifNull: ["$coinsAmount", 0] } },
              averagePurchaseAmount: { $avg: "$amount" },
            },
          },
        ],

        transactions: [
          { $sort: { createdAt: -1 } },

          {
            $project: {
              name: { $concat: ["$user.firstName", " ", "$user.lastName"] },
              email: "$user.email",
              coinsBought: "$coinsAmount",
              value: "$amount",
              paymentType: "$paymentType",
              date: "$createdAt",
            },
          },

          { $skip: skip },
          { $limit: limit },
        ],
      },
    });

    const result = await Payment.aggregate(pipeline);

    const stats = result[0].stats[0] || {
      totalTransactions: 0,
      totalRevenue: 0,
      totalCoinsBought: 0,
      averagePurchaseAmount: 0,
    };

    const transactions = result[0].transactions;

    return res.status(200).json({
      status: "success",
      stats,
      pagination: {
        total: stats.totalTransactions,
        page: Number(page),
        pages: Math.ceil(stats.totalTransactions / limit),
      },
      results: transactions.length,
      data: transactions,
    });
  } catch (error: any) {
    console.log("Analytics error:", error);

    return res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
};

export const addMentor = async (req: Request, res: Response) => {
  try {
    const adminId = req.admin;
    const { firstName, lastName, email, course } = req.body;

    if (!adminId) {
      return res.status(401).json({
        status: "error",
        message: "Unauthorized",
      });
    }

    // Check if mentor already exists
    const existingMentor = await Mentor.findOne({ email });
    if (existingMentor) {
      return res.status(400).json({
        status: "error",
        message: "Mentor with this email already exists",
      });
    }

    // Create new mentor
    const newMentor = await Mentor.create({
      firstName,
      lastName,
      email,
      course,
    });

    return res.status(201).json({
      status: "success",
      data: newMentor,
    });
  } catch (error: any) {
    console.log("Error adding mentor:", error);

    return res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
};

export const fetchMentorDetails = async (req: Request, res: Response) => {
  try {
    const adminId = req.admin;

    if (!adminId) {
      return res.status(401).json({
        status: "error",
        message: "Unauthorized",
      });
    }

    const { mentorId } = req.params;

    const mentor = await Mentor.findById(mentorId).populate({
      path: "mentees",
      select: "firstName lastName email",
    });

    if (!mentor) {
      return res.status(404).json({
        status: "error",
        message: "Mentor not found",
      });
    }

    return res.status(200).json({
      status: "success",
      data: mentor,
    });
  } catch (error: any) {
    console.log("Error fetching mentor details:", error);

    return res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
};

export const suspendMentor = async (req: Request, res: Response) => {
  try {
    const adminId = req.admin;

    if (!adminId) {
      return res.status(401).json({
        status: "error",
        message: "Unauthorized",
      });
    }

    const { mentorId } = req.params;

    const mentor = await Mentor.findById(mentorId);
    if (!mentor) {
      return res.status(404).json({
        status: "error",
        message: "Mentor not found",
      });
    }

    mentor.status = "suspended";
    await mentor.save();

    return res.status(200).json({
      status: "success",
      message: "Mentor suspended successfully",
    });
  } catch (error: any) {
    console.log("Error suspending mentor:", error);

    return res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
};

export const activateMentor = async (req: Request, res: Response) => {
  try {
    const adminId = req.admin;

    if (!adminId) {
      return res.status(401).json({
        status: "error",
        message: "Unauthorized",
      });
    }

    const { mentorId } = req.params;

    const mentor = await Mentor.findById(mentorId);
    if (!mentor) {
      return res.status(404).json({
        status: "error",
        message: "Mentor not found",
      });
    }

    mentor.status = "active";
    await mentor.save();

    return res.status(200).json({
      status: "success",
      message: "Mentor activated successfully",
    });
  } catch (error: any) {
    console.log("Error activating mentor:", error);

    return res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
};
