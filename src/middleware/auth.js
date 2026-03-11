const jwt = require("jsonwebtoken");

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Token ausente." });
  }

  const token = authHeader.slice(7);
  try {
    const secret = String(process.env.JWT_SECRET || "");
    const isProd = String(process.env.NODE_ENV || "").toLowerCase() === "production";
    if (isProd && (secret.length < 32 || secret.toLowerCase().includes("default"))) {
      return res.status(500).json({ message: "Configuracao de autenticacao invalida no servidor." });
    }
    const payload = jwt.verify(token, secret || "default_secret");
    req.user = payload;
    return next();
  } catch (error) {
    return res.status(401).json({ message: "Token inválido." });
  }
}

module.exports = { authMiddleware };
