import { Request, Response } from "express";
import Discussion from "../models/discussionsModel.js";
import { sendDiscussionMessage } from "../utils/sendDiscussionService.js";

export const fetchSubmissionDiscussion = async (
  req: Request,
  res: Response,
) => {
  try {
    const userId = req.user || req.mentor;

    const { discussionId } = req.params;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User not authorized",
      });
    }

    const discussion = await Discussion.findOne({
      discussionId,
    });

    if (!discussion) {
      return res.status(404).json({
        status: "error",
        message: "Discussion not found",
      });
    }

    const chatUser = discussion?.mentor ?? discussion?.mentee;

    if (userId !== chatUser) {
      return res.status(400).json({
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
    const userType = req.user ? "mentee" : "mentor";

    const { discussionId } = req.params;

    if (!discussionId || Array.isArray(discussionId)) {
      return res.status(400).json({
        success: false,
        message: "discussionId is required",
      });
    }

    const { message } = req.body;

    if (!message) {
      return res.status(400).json({
        success: false,
        message: "Message is required",
      });
    }

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User not authorized",
      });
    }

    const discussion = await Discussion.findOne({
      discussionId,
    });

    if (!discussion) {
      return res.status(404).json({
        status: "error",
        message: "Discussion not found",
      });
    }

    const chatUser = discussion.mentor ?? discussion?.mentee;

    if (!chatUser?.equals(userId)) {
      return res.status(400).json({
        status: "error",
        message: "Discussion access denied for this user",
      });
    }

    const newDiscussion = await sendDiscussionMessage({
      discussionId,
      userId,
      userType,
      message,
    });

    return res.status(201).json({
      success: true,
      messageData: newDiscussion,
    });
  } catch (error: any) {
    console.error("Error sending message:", error);
    return res.status(500).json({ error: "Failed to send message" });
  }
};
