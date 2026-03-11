import { Request, Response } from "express";
import bcrypt from "bcrypt";
import User from "../models/userModel.js";
import jwt from "jsonwebtoken";
import validator from "validator";
import {
  LoginRequestBody,
  RegisterRequestBody,
} from "../interface/allInterfaces.js";
import Mentor from "../models/mentorModel.js";
import { signAccessToken, signRefreshToken } from "../helpers/jwtHelper.js";
import Admin from "../models/adminModel.js";

// import { sendUserVerificationEmail } from "../utils/emailSender.js";
// import { UserVerificationCodes } from "../utils/verificationCodes.js";

// User Registration
export const registerUser = async (
  req: Request<{}, {}, RegisterRequestBody>,
  res: Response,
) => {
  try {
    const { firstName, lastName, email, password, phoneNumber, course } =
      req.body;

    // Validate user input
    if (
      !email ||
      !password ||
      !phoneNumber ||
      !firstName ||
      !lastName ||
      !course
    ) {
      return res.status(400).json({
        status: "fail",
        message: "All fields are required",
      });
    }

    // Validate password strength
    if (
      !validator.isStrongPassword(password, {
        minLength: 8,
        minUppercase: 1,
        minSymbols: 1,
        minNumbers: 1,
      })
    ) {
      return res.status(400).json({
        status: "fail",
        message:
          "Password must be at least 8 characters and include an uppercase letter, number, and symbol",
      });
    }

    // Normalize email
    const normalizedEmail = email.toLowerCase().trim();

    // Validate email format
    if (!validator.isEmail(normalizedEmail)) {
      return res.status(400).json({
        status: "fail",
        message: "Invalid email format",
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Check if user already exists
    const existingUser = await User.findOne({ normalizedEmail });

    const existingPhone = await User.findOne({ phoneNumber });

    if (existingUser) {
      return res.status(400).json({
        status: "fail",
        message: "User is already registered and verified",
      });
    } else if (existingPhone) {
      return res.status(400).json({
        status: "fail",
        message: "Phone number in use!",
      });
    } else {
      // Create new user
      await User.create({
        email: normalizedEmail,
        password: hashedPassword,
        firstName,
        lastName,
        course,
        phoneNumber,
        isVerified: true,
      });
    }

    // Send verification email
    // const verificationCode =
    //   UserVerificationCodes.generateVerificationCode(email);
    // await sendUserVerificationEmail(email, verificationCode, false);

    // Respond with success
    return res.status(201).json({
      status: "success",
      message: "User registered successfully",
    });
  } catch (err: any) {
    console.error("Error registering user:", err);
    return res.status(500).json({
      status: "error",
      message: "Registration failed",
      error: err.message,
    });
  }
};

// User Login
export const login = async (
  req: Request<{}, {}, LoginRequestBody>,
  res: Response,
) => {
  try {
    const { email, password, rememberMe } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        status: "fail",
        message: "Email and password required",
      });
    }

    const user = await User.findOne({ email }).select("+password");

    // Check if user exists and has a password
    if (!user || !user.password) {
      return res.status(401).json({
        status: "fail",
        message: "Invalid credentials",
      });
    }

    // Verify both password and user.password are defined before comparing
    if (!password || !user.password) {
      return res.status(401).json({
        status: "fail",
        message: "Invalid credentials",
      });
    }

    // Compare passwords
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        status: "fail",
        message: "Invalid credentials",
      });
    }

    user.password = null;

    const isSecure = req.secure || req.headers["x-forwarded-proto"] === "https";

    if (rememberMe) {
      const refreshToken = signRefreshToken(user._id.toString());

      res.cookie("refresh_token", refreshToken, {
        httpOnly: true,
        secure: isSecure,
        sameSite: "none",
        path: "/api/auth/users/refresh-token", // very important
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });
    }

    const accessToken = signAccessToken(user._id.toString());

    res.cookie("access_token", accessToken, {
      httpOnly: true,
      secure: isSecure,
      sameSite: "none",
      maxAge: 3 * 24 * 60 * 60 * 1000, // 15 minutes
    });

    return res.status(200).json({
      status: "success",
      data: { user },
    });
  } catch (err: any) {
    console.error("Login error:", err);

    return res.status(500).json({
      status: "error",
      message: "Login failed due to server error",
      details: err.message,
    });
  }
};

export const refreshToken = async (req: Request, res: Response) => {
  try {
    const refreshToken = req.cookies.refresh_token;
    if (!refreshToken) {
      return res.status(401).json({
        status: "fail",
        message: "Refresh token missing",
      });
    }
    const isSecure = req.secure || req.headers["x-forwarded-proto"] === "https";

    const refreshSecret = process.env.JWT_SECRET;
    if (!refreshSecret) {
      throw new Error("JWT_SECRET is not defined");
    }

    const decoded = jwt.verify(refreshToken, refreshSecret) as {
      id: string;
      type: string;
    };

    if (!decoded || decoded.type !== "refresh") {
      res.clearCookie("refresh_token", {
        httpOnly: true,
        secure: isSecure,
        sameSite: "none",
        path: "/api/auth/users/refresh-token",
      });
      return res.status(401).json({
        status: "fail",
        message: "Invalid or expired refresh token",
      });
    }

    const user = await User.findById(decoded.id).select("-password");
    if (!user) {
      return res.status(401).json({
        status: "fail",
        message: "User not found",
      });
    }

    const newAccessToken = signAccessToken(user._id.toString());

    res.cookie("access_token", newAccessToken, {
      httpOnly: true,
      secure: isSecure,
      sameSite: "lax",
      maxAge: 3 * 24 * 60 * 60 * 1000, // 15 minutes
    });

    return res.status(200).json({
      status: "success",
      data: { user },
    });
  } catch (err: any) {
    console.error("Refresh token error:", err);

    return res.status(401).json({
      status: "error",
      message: "Failed to refresh access token",
      details: err.message,
    });
  }
};

export const changeMenteePassword = async (req: Request, res: Response) => {
  try {
    const { email, newPassword } = req.body;

    if (!email || !newPassword) {
      return res.status(400).json({
        status: "fail",
        message: "Email, current password, and new password are required",
      });
    }

    const user = await User.findOne({ email }).select("+password");

    if (!user || !user.password) {
      return res.status(404).json({
        status: "fail",
        message: "User not found",
      });
    }

    // const isCurrentPasswordValid = await bcrypt.compare(
    //   currentPassword,
    //   mentor.password,
    // );

    // if (!isCurrentPasswordValid) {
    //   return res.status(401).json({
    //     status: "fail",
    //     message: "Current password is incorrect",
    //   });
    // }

    if (
      !validator.isStrongPassword(newPassword, {
        minLength: 8,
        minUppercase: 1,
        minSymbols: 1,
        minNumbers: 1,
      })
    ) {
      return res.status(400).json({
        status: "fail",
        message:
          "New password must be at least 8 characters and include an uppercase letter, number, and symbol",
      });
    }

    const hashedNewPassword = await bcrypt.hash(newPassword, 12);

    user.password = hashedNewPassword;
    await user.save();

    return res.status(200).json({
      status: "success",
      message: "Password changed successfully",
    });
  } catch (err: any) {
    console.error("Change user password error:", err);
    return res.status(500).json({
      status: "error",
      message: "Failed to change password",
      details: err.message,
    });
  }
};

// Mentor Login
export const mentorLogin = async (
  req: Request<{}, {}, LoginRequestBody>,
  res: Response,
) => {
  try {
    const { email, password, rememberMe } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        status: "fail",
        message: "Email and password required",
      });
    }

    const mentor = await Mentor.findOne({ email }).select("+password");

    // Check if user exists and has a password
    if (!mentor || !mentor.password) {
      return res.status(401).json({
        status: "fail",
        message: "Invalid credentials",
      });
    }

    // Verify both password and user.password are defined before comparing
    if (!password || !mentor.password) {
      return res.status(401).json({
        status: "fail",
        message: "Invalid credentials",
      });
    }

    // Compare passwords
    const isPasswordValid = await bcrypt.compare(password, mentor.password);

    if (!isPasswordValid) {
      return res.status(401).json({
        status: "fail",
        message: "Invalid credentials",
      });
    }

    mentor.password = null;

    // Detect if request is secure (HTTPS)
    const isSecure = req.secure || req.headers["x-forwarded-proto"] === "https";

    if (rememberMe) {
      const refreshToken = signRefreshToken(mentor._id.toString());

      res.cookie("refresh_token", refreshToken, {
        httpOnly: true,
        secure: isSecure,
        sameSite: "none",
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });
    }

    const accessToken = signAccessToken(mentor._id.toString());

    res.cookie("access_token", accessToken, {
      httpOnly: true,
      secure: isSecure,
      sameSite: "none",
      maxAge: 3 * 24 * 60 * 60 * 1000, // 24 hours
    });

    return res.status(200).json({
      status: "success",
      data: { user: mentor },
    });
  } catch (err: any) {
    console.error("Mentor login error:", err);

    return res.status(500).json({
      status: "error",
      message: "Mentor login failed due to server error",
      details: err.message,
    });
  }
};

export const mentorRefreshToken = async (req: Request, res: Response) => {
  try {
    const refreshToken = req.cookies.refresh_token;
    if (!refreshToken) {
      return res.status(401).json({
        status: "fail",
        message: "Refresh token missing",
      });
    }

    const isSecure = req.secure || req.headers["x-forwarded-proto"] === "https";

    const refreshSecret = process.env.JWT_SECRET;

    if (!refreshSecret) {
      throw new Error("JWT_SECRET is not defined");
    }

    const decoded = jwt.verify(refreshToken, refreshSecret) as {
      id: string;
      type: string;
    };

    if (!decoded || decoded.type !== "refresh") {
      res.clearCookie("refresh_token", {
        httpOnly: true,
        secure: isSecure,
        sameSite: "none",
      });

      return res.status(401).json({
        status: "fail",
        message: "Invalid or expired refresh token",
      });
    }

    const mentor = await Mentor.findById(decoded.id).select("-password");
    if (!mentor) {
      return res.status(401).json({
        status: "fail",
        message: "Mentor not found",
      });
    }

    const newAccessToken = signAccessToken(mentor._id.toString());

    res.cookie("access_token", newAccessToken, {
      httpOnly: true,
      secure: isSecure,
      sameSite: "none",
      maxAge: 3 * 24 * 60 * 60 * 1000, // 3 days
    });

    return res.status(200).json({
      status: "success",
      data: { user: mentor },
    });
  } catch (err: any) {
    console.error("Mentor refresh token error:", err);
    return res.status(401).json({
      status: "error",
      message: "Failed to refresh access token",
      details: err.message,
    });
  }
};

export const changeMentorPassword = async (req: Request, res: Response) => {
  try {
    const { email, newPassword } = req.body;

    if (!email || !newPassword) {
      return res.status(400).json({
        status: "fail",
        message: "Email, current password, and new password are required",
      });
    }

    const mentor = await Mentor.findOne({ email }).select("+password");

    if (!mentor || !mentor.password) {
      return res.status(404).json({
        status: "fail",
        message: "Mentor not found",
      });
    }

    // const isCurrentPasswordValid = await bcrypt.compare(
    //   currentPassword,
    //   mentor.password,
    // );

    // if (!isCurrentPasswordValid) {
    //   return res.status(401).json({
    //     status: "fail",
    //     message: "Current password is incorrect",
    //   });
    // }

    if (
      !validator.isStrongPassword(newPassword, {
        minLength: 8,
        minUppercase: 1,
        minSymbols: 1,
        minNumbers: 1,
      })
    ) {
      return res.status(400).json({
        status: "fail",
        message:
          "New password must be at least 8 characters and include an uppercase letter, number, and symbol",
      });
    }

    const hashedNewPassword = await bcrypt.hash(newPassword, 12);

    mentor.password = hashedNewPassword;
    await mentor.save();

    return res.status(200).json({
      status: "success",
      message: "Password changed successfully",
    });
  } catch (err: any) {
    console.error("Change mentor password error:", err);
    return res.status(500).json({
      status: "error",
      message: "Failed to change password",
      details: err.message,
    });
  }
};

// Mentor Login
export const adminLogin = async (
  req: Request<{}, {}, LoginRequestBody>,
  res: Response,
) => {
  try {
    const { email, password, rememberMe } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        status: "fail",
        message: "Email and password required",
      });
    }

    const admin = await Admin.findOne({ email }).select("+password");

    // Check if user exists and has a password
    if (!admin || !admin.password) {
      return res.status(401).json({
        status: "fail",
        message: "Invalid credentials",
      });
    }

    // Verify both password and user.password are defined before comparing
    if (!password || !admin.password) {
      return res.status(401).json({
        status: "fail",
        message: "Invalid credentials",
      });
    }

    // Compare passwords
    const isPasswordValid = await bcrypt.compare(password, admin.password);

    if (!isPasswordValid) {
      return res.status(401).json({
        status: "fail",
        message: "Invalid credentials",
      });
    }

    admin.password = null;

    // Detect if request is secure (HTTPS)
    const isSecure = req.secure || req.headers["x-forwarded-proto"] === "https";

    if (rememberMe) {
      const refreshToken = signRefreshToken(admin._id.toString());

      res.cookie("refresh_token", refreshToken, {
        httpOnly: true,
        secure: isSecure,
        sameSite: "none",
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });
    }

    const accessToken = signAccessToken(admin._id.toString());

    res.cookie("access_token", accessToken, {
      httpOnly: true,
      secure: isSecure,
      sameSite: "none",
      maxAge: 3 * 24 * 60 * 60 * 1000, // 24 hours
    });

    return res.status(200).json({
      status: "success",
      data: { user: admin },
    });
  } catch (err: any) {
    console.error("Admin login error:", err);

    return res.status(500).json({
      status: "error",
      message: "Admin login failed due to server error",
      details: err.message,
    });
  }
};


export const changeAdminPassword = async (req: Request, res: Response) => {
  try {
    const { email, newPassword } = req.body;

    if (!email || !newPassword) {
      return res.status(400).json({
        status: "fail",
        message: "Email, current password, and new password are required",
      });
    }

    const admin = await Admin.findOne({ email }).select("+password");

    if (!admin || !admin.password) {
      return res.status(404).json({
        status: "fail",
        message: "Admin not found",
      });
    }

    // const isCurrentPasswordValid = await bcrypt.compare(
    //   currentPassword,
    //   admin.password,
    // );

    // if (!isCurrentPasswordValid) {
    //   return res.status(401).json({
    //     status: "fail",
    //     message: "Current password is incorrect",
    //   });
    // }

    if (
      !validator.isStrongPassword(newPassword, {
        minLength: 8,
        minUppercase: 1,
        minSymbols: 1,
        minNumbers: 1,
      })
    ) {
      return res.status(400).json({
        status: "fail",
        message:
          "New password must be at least 8 characters and include an uppercase letter, number, and symbol",
      });
    }

    const hashedNewPassword = await bcrypt.hash(newPassword, 12);

    admin.password = hashedNewPassword;
    await admin.save();

    return res.status(200).json({
      status: "success",
      message: "Password changed successfully",
    });
  } catch (err: any) {
    console.error("Change admin password error:", err);
    return res.status(500).json({
      status: "error",
      message: "Failed to change password",
      details: err.message,
    });
  }
};


export const adminRefreshToken = async (req: Request, res: Response) => {
  try {
    const refreshToken = req.cookies.refresh_token;
    if (!refreshToken) {
      return res.status(401).json({
        status: "fail",
        message: "Refresh token missing",
      });
    }

    const isSecure = req.secure || req.headers["x-forwarded-proto"] === "https";

    const refreshSecret = process.env.JWT_SECRET;

    if (!refreshSecret) {
      throw new Error("JWT_SECRET is not defined");
    }

    const decoded = jwt.verify(refreshToken, refreshSecret) as {
      id: string;
      type: string;
    };

    if (!decoded || decoded.type !== "refresh") {
      res.clearCookie("refresh_token", {
        httpOnly: true,
        secure: isSecure,
        sameSite: "none",
      });

      return res.status(401).json({
        status: "fail",
        message: "Invalid or expired refresh token",
      });
    }

    const admin = await Admin.findById(decoded.id).select("-password");
    if (!admin) {
      return res.status(401).json({
        status: "fail",
        message: "Admin not found",
      });
    }

    const newAccessToken = signAccessToken(admin._id.toString());

    res.cookie("access_token", newAccessToken, {
      httpOnly: true,
      secure: isSecure,
      sameSite: "none",
      maxAge: 3 * 24 * 60 * 60 * 1000, // 3 days
    });

    return res.status(200).json({
      status: "success",
      data: { user: admin },
    });
  } catch (err: any) {
    console.error("Admin refresh token error:", err);
    return res.status(401).json({
      status: "error",
      message: "Failed to refresh access token",
      details: err.message,
    });
  }
};