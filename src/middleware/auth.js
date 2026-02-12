const jwt = require("jsonwebtoken");

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Token ausente." });
  }

  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || "default_secret");
    req.user = payload;
    return next();
  } catch (error) {
    return res.status(401).json({ message: "Token inválido." });
  }
}

module.exports = { authMiddleware };
