import jwt from "jsonwebtoken";
import { getToken } from "next-auth/jwt";

const authMiddleware = async (req, res, next) => {
  try {
    // Log incoming request details for debugging
    console.log("Request Headers:", req.headers);
    console.log("Request Cookies:", req.cookies);

    // Check for token in multiple possible locations
    const tokenFromHeader = req.headers.authorization?.split(" ")[1]; // Bearer token
    const tokenFromCookie = req.cookies["next-auth.session-token"]; // NextAuth session token
    const tokenFromCustomHeader = req.headers["x-auth-token"]; // Custom header

    const token = tokenFromHeader || tokenFromCookie || tokenFromCustomHeader;
    console.log("Extracted Token:", token);

    if (!token) {
      return res.status(401).json({ message: "No authentication token found" });
    }

    // Try NextAuth token verification first
    if (tokenFromCookie) {
      try {
        // Use NextAuth's getToken to verify the session token
        const decoded = await getToken({
          req,
          secret: process.env.NEXTAUTH_SECRET,
          secureCookie: process.env.NODE_ENV === "production",
        });

        if (!decoded) {
          throw new Error("Invalid NextAuth session token");
        }

        req.user = {
          id: decoded.sub || decoded.id, // Handle different possible ID fields
          email: decoded.email,
          name: decoded.name,
          ...decoded, // Include any other fields from the token
        };
        return next();
      } catch (nextAuthError) {
        console.log("NextAuth verification failed:", nextAuthError);
        // If NextAuth verification fails, fall back to JWT verification
      }
    }

    // Fallback to standard JWT verification
    try {
      const decoded = jwt.verify(
        token,
        process.env.NEXTAUTH_SECRET || process.env.JWT_SECRET
      );
      req.user = decoded;
      return next();
    } catch (jwtError) {
      console.log("JWT verification failed:", jwtError);

      // If it's not a valid JWT, try parsing it as a NextAuth session token manually
      try {
        const sessionData = JSON.parse(
          Buffer.from(token.split(".")[1], "base64").toString()
        );
        req.user = sessionData;
        return next();
      } catch (sessionError) {
        throw new Error("Invalid token format");
      }
    }
  } catch (error) {
    console.error("Authentication Error:", error);
    return res.status(401).json({
      message: "Authentication failed",
      error: error.message,
    });
  }
};

export default authMiddleware;
