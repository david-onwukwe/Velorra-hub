const jwt = require("jsonwebtoken");

const SECRET = process.env.JWT_SECRET || "insecure-dev-secret-change-me";

function signToken(payload) {
  return jwt.sign(payload, SECRET, { expiresIn: "12h" });
}

function requireAdmin(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Missing authorization token." });
  try {
    const decoded = jwt.verify(token, SECRET);
    if (decoded.role !== "admin") throw new Error("not admin");
    req.admin = decoded;
    next();
  } catch (e) {
    return res.status(401).json({ error: "Invalid or expired session. Please log in again." });
  }
}

module.exports = { signToken, requireAdmin };
