import { Request, Response, NextFunction } from "express";

type Role = "mentee" | "mentor";

// Define role hierarchy (higher index = higher privilege)
const roleHierarchy: Record<Role, number> = {
  mentee: 1,
  mentor: 2,
};

// Middleware to check if user has minimum required role
export const requireRole = (requiredRole: Role) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const mentee = req.user;
      const mentor = req.mentor;

      // Ensure user is authenticated first
      if (!mentor && !mentee) {
        return res.status(401).json({
          success: false,
          message: "Authentication required",
        });
      }

      const user = mentor ?? mentee;
      const userRole = user === mentee ? "mentee" : "mentor";

      // Check if user's role meets or exceeds required role in hierarchy
      const userRoleLevel = roleHierarchy[userRole];
      const requiredRoleLevel = roleHierarchy[requiredRole];

      if (userRoleLevel === undefined || requiredRoleLevel === undefined) {
        return res.status(403).json({
          success: false,
          message: "Access denied. Invalid role configuration.",
        });
      }

      if (userRoleLevel >= requiredRoleLevel) {
        // User has sufficient privileges
        return next();
      } else {
        return res.status(403).json({
          success: false,
          message: `Access denied. Requires ${requiredRole} role or higher.`,
        });
      }
    } catch (error) {
      console.error("Role authorization error:", error);
      return res.status(500).json({
        success: false,
        message: "Internal server error during authorization",
      });
    }
  };
};
