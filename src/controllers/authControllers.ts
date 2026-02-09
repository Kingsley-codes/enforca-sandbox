import { Request, Response } from "express";
import bcrypt from "bcrypt";
import User from "../models/userModel.js";
import jwt, { SignOptions } from "jsonwebtoken";
import validator from "validator";
import {
  LoginRequestBody,
  RegisterRequestBody,
} from "../interface/admin.interface.js";
import { sendUserVerificationEmail } from "../utils/emailSender.js";
import { UserVerificationCodes } from "../utils/verificationCodes.js";

// Helper function to sign JWT tokens for User
const signToken = (id: string): string => {
  const secret = process.env.JWT_SECRET;
  const expiresIn = process.env.JWT_EXPIRES_IN;

  if (!secret) throw new Error("JWT_SECRET is not defined");
  if (!expiresIn) throw new Error("JWT_EXPIRES_IN is not defined");

  return jwt.sign({ id }, secret, {
    expiresIn: expiresIn as NonNullable<SignOptions["expiresIn"]>,
  });
};

// User Registration
export const registerUser = async (
  req: Request<{}, {}, RegisterRequestBody>,
  res: Response,
) => {
  try {
    const { firstName, lastName, email, password, confirmPassword } = req.body;

    // Validate user input
    if (!email || !password || !confirmPassword || !firstName || !lastName) {
      return res.status(400).json({
        status: "fail",
        message: "All fields are required",
      });
    }

    // Check if passwords match
    if (password !== confirmPassword) {
      return res.status(400).json({
        status: "fail",
        message: "Passwords do not match",
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

    // Validate email format
    if (!validator.isEmail(email)) {
      return res.status(400).json({
        status: "fail",
        message: "Invalid email format",
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser && existingUser.isVerified) {
      return res.status(400).json({
        status: "fail",
        message: "User is already registered and verified",
      });
    } else {
      // Create new user
      await User.create({
        email,
        password: hashedPassword,
        firstName,
        lastName,
      });
    }

    // Send verification email
    const verificationCode =
      UserVerificationCodes.generateVerificationCode(email);
    await sendUserVerificationEmail(email, verificationCode, false);

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
    const { email, password } = req.body;

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

    // if (!user.isVerified) {
    //   return res.status(401).json({
    //     status: "fail",
    //     message: "Account not verified"
    //   });
    // }

    const token = signToken(user._id.toString());
    user.password = null;

    res.cookie("user_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
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
      stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
    });
  }
};

// Producer Login
// export const loginProducer = async (
//   req: Request<{}, {}, LoginRequestBody>,
//   res: Response,
// ) => {
//   try {
//     const { email, password } = req.body;

//     if (!email || !password) {
//       return res.status(400).json({
//         status: "fail",
//         message: "Email and password required",
//       });
//     }

//     const producer = await Producer.findOne({ email }).select("+password");

//     // Check if user exists and has a password
//     if (!producer || !producer.password) {
//       return res.status(401).json({
//         status: "fail",
//         message: "Invalid credentials",
//       });
//     }

//     // Verify both password and user.password are defined before comparing
//     if (!password || !producer.password) {
//       return res.status(401).json({
//         status: "fail",
//         message: "Invalid credentials",
//       });
//     }

//     // Compare passwords
//     const isPasswordValid = await bcrypt.compare(password, producer.password);
//     if (!isPasswordValid) {
//       return res.status(401).json({
//         status: "fail",
//         message: "Invalid credentials",
//       });
//     }

//     const token = signToken(producer._id.toString());
//     producer.password = null;

//     res.cookie("producer_token", token, {
//       httpOnly: true,
//       secure: process.env.NODE_ENV === "production",
//       sameSite: "strict",
//       maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
//     });

//     return res.status(200).json({
//       status: "success",
//       data: { producer },
//     });
//   } catch (err: any) {
//     console.error("Login error:", err);

//     return res.status(500).json({
//       status: "error",
//       message: "Login failed due to server error",
//       details: err.message,
//       stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
//     });
//   }
// };
