import { Request, Response } from "express";
import Discussion from "../models/discussionsModel.js";
import Submission from "../models/submissionModel.js";
import { Types } from "mongoose";

export const fetchSubmissionDiscussion = async (
  req: Request,
  res: Response,
) => {
  try {
    const userId = req.user || req.mentor;

    const { id: submissionId } = req.params;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User not authorized",
      });
    }

    const discussion = await Discussion.findOne({
      submission: submissionId,
    });

    if (!discussion) {
      return res.status(404).json({
        status: "error",
        message: "Discussion not found",
      });
    }

    const isMentor = discussion.mentor.toString() === userId.toString();
    const isMentee = discussion.mentee.toString() === userId.toString();

    if (!isMentor && !isMentee) {
      return res.status(403).json({
        status: "error",
        message: "Discussion access denied for this user",
      });
    }

    const conversation = discussion.conversation.sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
    );

    return res.status(200).json({
      status: "success",
      message: "discussions fetched successfully",
      data: conversation,
    });
  } catch (error: any) {
    console.log("Error fetching discussions:", error);
    return res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
};

export const sendDiscussion = async (req: Request, res: Response) => {
  try {
    const userId = req.user || req.mentor;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User not authorized",
      });
    }

    const senderRole = req.mentor ? "Mentor" : "Mentee"; // must match schema

    const { id: submissionId } = req.params;

    if (!submissionId) {
      return res.status(400).json({
        success: false,
        message: "Submission ID is required",
      });
    }

    const { message } = req.body;

    if (!message) {
      return res.status(400).json({
        success: false,
        message: "Message is required",
      });
    }

    const submission = await Submission.findById(submissionId);

    if (!submission) {
      return res.status(404).json({
        success: false,
        message: "Submission not found",
      });
    }

    let discussion = await Discussion.findOne({
      submission: submissionId,
    });

    // ✅ permission check using submission (safer)
    const isMentor = submission.mentor?.toString() === userId.toString();
    const isMentee = submission.mentee?.toString() === userId.toString();

    if (!isMentor && !isMentee) {
      return res.status(403).json({
        success: false,
        message: "Discussion access denied for this user",
      });
    }

    const newMessage = {
      sender: new Types.ObjectId(userId),
      senderRole,
      message,
    };

    // ✅ if discussion does NOT exist → create

    if (!discussion) {
      discussion = await Discussion.create({
        submission: submission._id,
        mentor: submission.mentor,
        mentee: submission.mentee,
        conversation: [newMessage],
      });
    } else {
      // ✅ if discussion exists → push message

      discussion.conversation.push(newMessage);
      await discussion.save();
    }

    return res.status(201).json({
      success: true,
      messageData: discussion.conversation.at(-1),
    });
  } catch (error) {
    console.error("Error sending message:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to send message",
    });
  }
};
