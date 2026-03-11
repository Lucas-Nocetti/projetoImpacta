const path = require("path");
const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const dotenv = require("dotenv");
const { initDb } = require("./db");
const { authMiddleware } = require("./middleware/auth");

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 3000);
const JWT_SECRET = String(process.env.JWT_SECRET || "");
const IS_PROD = String(process.env.NODE_ENV || "").toLowerCase() === "production";
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_REGEX = /^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{10,}$/;
const ALLOWED_STATUS = ["a_fazer", "fazendo", "concluido"];
const ALLOWED_ROLES = ["admin", "member"];
const ALLOWED_COMMENT_TYPES = ["bug", "melhoria", "anotacao", "bloqueado"];
const SQL_NOW_BR = "CURRENT_TIMESTAMP";
const ALLOWED_ORIGINS = String(process.env.CORS_ORIGINS || "http://localhost:3000")
  .split(",")
  .map((item) => item.trim())
  .filter(Boolean);
const AUTH_WINDOW_MS = 15 * 60 * 1000;
const AUTH_MAX_ATTEMPTS = 8;
const authAttempts = new Map();

if (IS_PROD && (JWT_SECRET.length < 32 || JWT_SECRET.toLowerCase().includes("default"))) {
  throw new Error("JWT_SECRET invalido. Defina uma chave forte com no minimo 32 caracteres.");
}

app.disable("x-powered-by");
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
      return callback(new Error("Origem nao permitida pelo CORS."));
    }
  })
);
app.use(express.json({ limit: "100kb" }));
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "same-origin");
  res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
  res.setHeader("Permissions-Policy", "geolocation=(), microphone=(), camera=()");
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none';"
  );
  next();
});
app.use(express.static(path.resolve(__dirname, "..", "public")));

let db;

function normalizeText(value) {
  return String(value || "").trim();
}

function hasUnsafeHtml(value) {
  return /[<>]/.test(String(value || ""));
}

function ensureSafeTextFields(fields) {
  return fields.every((value) => !hasUnsafeHtml(value));
}

function getClientIp(req) {
  return String(req.ip || req.connection?.remoteAddress || "unknown");
}

function checkAuthRateLimit(req, res) {
  const now = Date.now();
  const key = `${getClientIp(req)}:${req.path}`;
  const entry = authAttempts.get(key);
  if (!entry || now > entry.resetAt) {
    authAttempts.set(key, { count: 1, resetAt: now + AUTH_WINDOW_MS });
    return true;
  }
  if (entry.count >= AUTH_MAX_ATTEMPTS) {
    const seconds = Math.ceil((entry.resetAt - now) / 1000);
    res.setHeader("Retry-After", String(seconds));
    res.status(429).json({ message: "Muitas tentativas. Tente novamente em instantes." });
    return false;
  }
  entry.count += 1;
  return true;
}

function clearAuthRateLimit(req) {
  const key = `${getClientIp(req)}:${req.path}`;
  authAttempts.delete(key);
}

function normalizeEmail(value) {
  return normalizeText(value).toLowerCase();
}

function hasMinLength(value, min) {
  return normalizeText(value).length >= min;
}

function isFullName(value) {
  const name = normalizeText(value);
  return name.length >= 12 && /\S+\s+\S+/.test(name);
}

function createToken(user) {
  return jwt.sign(
    {
      id: user.id,
      name: user.name,
      email: user.email
    },
    JWT_SECRET,
    { expiresIn: "1d" }
  );
}

async function getProjectMembership(projectId, userId) {
  return db.get(
    `SELECT project_id AS projectId, user_id AS userId, role FROM project_members WHERE project_id = ? AND user_id = ?`,
    [projectId, userId]
  );
}

async function requireMembership(req, res, next) {
  const projectId = Number(req.params.projectId || req.query.projectId || req.body.projectId);
  if (!projectId) return res.status(400).json({ message: "projectId e obrigatorio." });

  const membership = await getProjectMembership(projectId, req.user.id);
  if (!membership) return res.status(403).json({ message: "Voce nao faz parte desse projeto." });

  req.projectId = projectId;
  req.membership = membership;
  return next();
}

function requireAdmin(req, res, next) {
  if (req.membership.role !== "admin") {
    return res.status(403).json({ message: "Apenas admins podem ajustar configuracoes do projeto." });
  }
  return next();
}

app.post("/api/auth/register", async (req, res) => {
  try {
    if (!checkAuthRateLimit(req, res)) return;
    const name = normalizeText(req.body.name);
    const email = normalizeEmail(req.body.email);
    const password = String(req.body.password || "");

    if (!name || !email || !password) {
      return res.status(400).json({ message: "Nome, e-mail e senha sao obrigatorios." });
    }
    if (!isFullName(name)) {
      return res
        .status(400)
        .json({ message: "Nome deve ser completo e conter no minimo 12 caracteres." });
    }
    if (!ensureSafeTextFields([name])) {
      return res.status(400).json({ message: "Nome contem caracteres nao permitidos." });
    }
    if (!EMAIL_REGEX.test(email)) {
      return res.status(400).json({ message: "Formato de e-mail invalido (ex: texto@texto.com)." });
    }
    if (!PASSWORD_REGEX.test(password)) {
      return res.status(400).json({
        message:
          "Senha invalida: use no minimo 10 caracteres com 1 letra maiuscula, 1 numero e 1 caractere especial."
      });
    }

    const existingEmail = await db.get(`SELECT id FROM users WHERE lower(email) = lower(?)`, [email]);
    if (existingEmail) return res.status(409).json({ message: "E-mail ja cadastrado." });

    const existingName = await db.get(`SELECT id FROM users WHERE lower(name) = lower(?)`, [name]);
    if (existingName) return res.status(409).json({ message: "Nome de usuario ja cadastrado." });

    const passwordHash = await bcrypt.hash(password, 10);
    const result = await db.run(
      `INSERT INTO users (name, email, password_hash, created_at) VALUES (?, ?, ?, ${SQL_NOW_BR})`,
      [name, email, passwordHash]
    );

    const user = await db.get(`SELECT id, name, email FROM users WHERE id = ?`, [result.lastID]);
    const token = createToken(user);
    clearAuthRateLimit(req);
    return res.status(201).json({ user, token });
  } catch (error) {
    return res.status(500).json({ message: "Erro ao registrar usuario." });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    if (!checkAuthRateLimit(req, res)) return;
    const email = normalizeEmail(req.body.email);
    const password = String(req.body.password || "");
    if (!email || !password) {
      return res.status(400).json({ message: "E-mail e senha sao obrigatorios." });
    }
    if (!EMAIL_REGEX.test(email)) {
      return res.status(400).json({ message: "Formato de e-mail invalido." });
    }

    const user = await db.get(`SELECT * FROM users WHERE lower(email) = lower(?)`, [email]);
    if (!user) return res.status(401).json({ message: "Credenciais invalidas." });

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) return res.status(401).json({ message: "Credenciais invalidas." });

    const safeUser = { id: user.id, name: user.name, email: user.email };
    const token = createToken(safeUser);
    clearAuthRateLimit(req);
    return res.json({ user: safeUser, token });
  } catch (error) {
    return res.status(500).json({ message: "Erro ao fazer login." });
  }
});

app.get("/api/users", authMiddleware, async (req, res) => {
  try {
    const projectId = Number(req.query.projectId);
    if (!projectId) return res.status(400).json({ message: "projectId e obrigatorio." });

    const membership = await getProjectMembership(projectId, req.user.id);
    if (!membership || membership.role !== "admin") {
      return res.status(403).json({ message: "Apenas admin do projeto pode listar usuarios." });
    }

    const users = await db.all(
      `
      SELECT u.id, u.name, u.email, pm.role
      FROM project_members pm
      INNER JOIN users u ON u.id = pm.user_id
      WHERE pm.project_id = ?
      ORDER BY u.name
      `,
      [projectId]
    );
    return res.json(users);
  } catch (error) {
    return res.status(500).json({ message: "Erro ao listar usuarios." });
  }
});

app.get("/api/projects", authMiddleware, async (req, res) => {
  try {
    const projects = await db.all(
      `
      SELECT
        p.id,
        p.name,
        p.description,
        p.created_at AS createdAt,
        pm.role,
        (
          SELECT COUNT(1) FROM tasks t WHERE t.project_id = p.id
        ) AS taskCount
      FROM projects p
      INNER JOIN project_members pm ON pm.project_id = p.id
      WHERE pm.user_id = ?
      ORDER BY p.created_at DESC
      `,
      [req.user.id]
    );
    return res.json(projects);
  } catch (error) {
    return res.status(500).json({ message: "Erro ao listar projetos." });
  }
});

app.post("/api/projects", authMiddleware, async (req, res) => {
  try {
    const name = normalizeText(req.body.name);
    const description = normalizeText(req.body.description);

    if (!name) return res.status(400).json({ message: "Nome do projeto e obrigatorio." });
    if (!hasMinLength(name, 5)) {
      return res.status(400).json({ message: "Nome do projeto deve ter no minimo 5 caracteres." });
    }
    if (!ensureSafeTextFields([name, description])) {
      return res.status(400).json({ message: "Texto contem caracteres nao permitidos." });
    }
    if (!hasMinLength(description, 15)) {
      return res.status(400).json({ message: "Descricao do projeto deve ter no minimo 15 caracteres." });
    }

    const existingProject = await db.get(`SELECT id FROM projects WHERE lower(name) = lower(?)`, [name]);
    if (existingProject) return res.status(409).json({ message: "Ja existe um projeto com esse nome." });

    const result = await db.run(
      `INSERT INTO projects (name, description, owner_id, created_at) VALUES (?, ?, ?, ${SQL_NOW_BR})`,
      [name, description, req.user.id]
    );

    await db.run(
      `INSERT INTO project_members (project_id, user_id, role, created_at) VALUES (?, ?, 'admin', ${SQL_NOW_BR})`,
      [result.lastID, req.user.id]
    );

    const project = await db.get(
      `SELECT id, name, description, created_at AS createdAt FROM projects WHERE id = ?`,
      [result.lastID]
    );
    return res.status(201).json({ ...project, role: "admin" });
  } catch (error) {
    return res.status(500).json({ message: "Erro ao criar projeto." });
  }
});

app.get("/api/projects/:projectId", authMiddleware, requireMembership, async (req, res) => {
  try {
    const project = await db.get(
      `
      SELECT id, name, description, created_at AS createdAt
      FROM projects
      WHERE id = ?
      `,
      [req.projectId]
    );
    if (!project) return res.status(404).json({ message: "Projeto nao encontrado." });

    const members = await db.all(
      `
      SELECT u.id, u.name, u.email, pm.role
      FROM project_members pm
      INNER JOIN users u ON u.id = pm.user_id
      WHERE pm.project_id = ?
      ORDER BY pm.role DESC, u.name ASC
      `,
      [req.projectId]
    );

    return res.json({ ...project, role: req.membership.role, members });
  } catch (error) {
    return res.status(500).json({ message: "Erro ao detalhar projeto." });
  }
});

app.patch("/api/projects/:projectId", authMiddleware, requireMembership, requireAdmin, async (req, res) => {
  try {
    const name = normalizeText(req.body.name);
    const description = normalizeText(req.body.description);

    if (!name) return res.status(400).json({ message: "Nome do projeto e obrigatorio." });
    if (!hasMinLength(name, 5)) {
      return res.status(400).json({ message: "Nome do projeto deve ter no minimo 5 caracteres." });
    }
    if (!ensureSafeTextFields([name, description])) {
      return res.status(400).json({ message: "Texto contem caracteres nao permitidos." });
    }
    if (!hasMinLength(description, 15)) {
      return res.status(400).json({ message: "Descricao do projeto deve ter no minimo 15 caracteres." });
    }

    const conflict = await db.get(
      `SELECT id FROM projects WHERE lower(name) = lower(?) AND id <> ?`,
      [name, req.projectId]
    );
    if (conflict) return res.status(409).json({ message: "Ja existe um projeto com esse nome." });

    await db.run(`UPDATE projects SET name = ?, description = ? WHERE id = ?`, [
      name,
      description,
      req.projectId
    ]);

    return res.json({ message: "Configuracoes do projeto atualizadas." });
  } catch (error) {
    return res.status(500).json({ message: "Erro ao atualizar projeto." });
  }
});

app.delete("/api/projects/:projectId", authMiddleware, requireMembership, requireAdmin, async (req, res) => {
  try {
    await db.run(`DELETE FROM projects WHERE id = ?`, [req.projectId]);
    return res.json({ message: "Projeto excluido com sucesso." });
  } catch (error) {
    return res.status(500).json({ message: "Erro ao excluir projeto." });
  }
});

app.post(
  "/api/projects/:projectId/members",
  authMiddleware,
  requireMembership,
  requireAdmin,
  async (req, res) => {
    try {
      const email = normalizeEmail(req.body.email);
      const role = normalizeText(req.body.role || "member") || "member";

      if (!email) return res.status(400).json({ message: "E-mail e obrigatorio." });
      if (!EMAIL_REGEX.test(email)) return res.status(400).json({ message: "Formato de e-mail invalido." });
      if (!ALLOWED_ROLES.includes(role)) return res.status(400).json({ message: "Role invalido." });

      const user = await db.get(`SELECT id, name, email FROM users WHERE lower(email) = lower(?)`, [email]);
      if (!user) return res.status(404).json({ message: "E-mail nao encontrado na base." });

      await db.run(
        `INSERT INTO project_members (project_id, user_id, role, created_at) VALUES (?, ?, ?, ${SQL_NOW_BR})
         ON CONFLICT(project_id, user_id) DO UPDATE SET role = excluded.role`,
        [req.projectId, user.id, role]
      );

      return res.status(201).json({ message: "Membro atualizado com sucesso.", user: { ...user, role } });
    } catch (error) {
      return res.status(500).json({ message: "Erro ao adicionar membro." });
    }
  }
);

app.patch(
  "/api/projects/:projectId/members/:userId",
  authMiddleware,
  requireMembership,
  requireAdmin,
  async (req, res) => {
    try {
      const userId = Number(req.params.userId);
      const role = normalizeText(req.body.role);
      if (!userId || !ALLOWED_ROLES.includes(role)) {
        return res.status(400).json({ message: "Dados de membro invalidos." });
      }

      const row = await db.get(
        `SELECT user_id AS userId, role FROM project_members WHERE project_id = ? AND user_id = ?`,
        [req.projectId, userId]
      );
      if (!row) return res.status(404).json({ message: "Membro nao encontrado no projeto." });
      if (userId === req.user.id && role !== "admin") {
        const adminCountRow = await db.get(
          `SELECT COUNT(1) AS total FROM project_members WHERE project_id = ? AND role = 'admin'`,
          [req.projectId]
        );
        if (Number(adminCountRow?.total || 0) <= 1) {
          return res.status(400).json({ message: "Projeto deve ter ao menos um admin." });
        }
      }

      await db.run(`UPDATE project_members SET role = ? WHERE project_id = ? AND user_id = ?`, [
        role,
        req.projectId,
        userId
      ]);
      return res.json({ message: "Permissao do membro atualizada." });
    } catch (error) {
      return res.status(500).json({ message: "Erro ao atualizar permissao do membro." });
    }
  }
);

app.delete(
  "/api/projects/:projectId/members/:userId",
  authMiddleware,
  requireMembership,
  requireAdmin,
  async (req, res) => {
    try {
      const userId = Number(req.params.userId);
      if (!userId) return res.status(400).json({ message: "userId invalido." });
      if (userId === req.user.id) {
        return res.status(400).json({ message: "Admin nao pode remover a propria conta do projeto." });
      }

      const row = await db.get(
        `SELECT user_id AS userId FROM project_members WHERE project_id = ? AND user_id = ?`,
        [req.projectId, userId]
      );
      if (!row) return res.status(404).json({ message: "Membro nao encontrado no projeto." });

      await db.run(`DELETE FROM project_members WHERE project_id = ? AND user_id = ?`, [
        req.projectId,
        userId
      ]);
      await db.run(`UPDATE tasks SET assigned_to = NULL WHERE project_id = ? AND assigned_to = ?`, [
        req.projectId,
        userId
      ]);

      return res.json({ message: "Membro removido com sucesso." });
    } catch (error) {
      return res.status(500).json({ message: "Erro ao remover membro do projeto." });
    }
  }
);

app.get("/api/projects/:projectId/comments", authMiddleware, requireMembership, async (req, res) => {
  try {
    const comments = await db.all(
      `
      SELECT
        pc.id,
        pc.content,
        pc.type,
        pc.created_at AS createdAt,
        u.id AS userId,
        u.name AS userName
      FROM project_comments pc
      INNER JOIN users u ON u.id = pc.user_id
      WHERE pc.project_id = ?
      ORDER BY pc.created_at DESC
      `,
      [req.projectId]
    );
    return res.json(comments);
  } catch (error) {
    return res.status(500).json({ message: "Erro ao listar comentarios do projeto." });
  }
});

app.post("/api/projects/:projectId/comments", authMiddleware, requireMembership, async (req, res) => {
  try {
    const content = normalizeText(req.body.content);
    const type = normalizeText(req.body.type || "anotacao");
    if (!ensureSafeTextFields([content])) {
      return res.status(400).json({ message: "Comentario contem caracteres nao permitidos." });
    }
    if (!hasMinLength(content, 20)) {
      return res.status(400).json({ message: "Comentario deve ter no minimo 20 caracteres." });
    }
    if (!ALLOWED_COMMENT_TYPES.includes(type)) {
      return res.status(400).json({ message: "Tipo de comentario invalido." });
    }

    const result = await db.run(
      `INSERT INTO project_comments (project_id, user_id, content, type, created_at) VALUES (?, ?, ?, ?, ${SQL_NOW_BR})`,
      [req.projectId, req.user.id, content, type]
    );
    const comment = await db.get(
      `
      SELECT
        pc.id,
        pc.content,
        pc.type,
        pc.created_at AS createdAt,
        u.id AS userId,
        u.name AS userName
      FROM project_comments pc
      INNER JOIN users u ON u.id = pc.user_id
      WHERE pc.id = ?
      `,
      [result.lastID]
    );
    return res.status(201).json(comment);
  } catch (error) {
    return res.status(500).json({ message: "Erro ao criar comentario do projeto." });
  }
});

app.patch("/api/projects/:projectId/comments/:commentId", authMiddleware, requireMembership, async (req, res) => {
  try {
    const commentId = Number(req.params.commentId);
    const content = normalizeText(req.body.content);
    const typeRaw = Object.prototype.hasOwnProperty.call(req.body, "type")
      ? normalizeText(req.body.type)
      : null;
    if (!commentId) return res.status(400).json({ message: "commentId invalido." });
    if (!ensureSafeTextFields([content])) {
      return res.status(400).json({ message: "Comentario contem caracteres nao permitidos." });
    }
    if (!hasMinLength(content, 20)) {
      return res.status(400).json({ message: "Comentario deve ter no minimo 20 caracteres." });
    }
    if (typeRaw !== null && !ALLOWED_COMMENT_TYPES.includes(typeRaw)) {
      return res.status(400).json({ message: "Tipo de comentario invalido." });
    }

    const existing = await db.get(
      `SELECT id, project_id AS projectId, user_id AS userId, type FROM project_comments WHERE id = ? AND project_id = ?`,
      [commentId, req.projectId]
    );
    if (!existing) return res.status(404).json({ message: "Comentario nao encontrado." });
    if (existing.userId !== req.user.id) {
      return res.status(403).json({ message: "Apenas o autor pode editar esse comentario." });
    }

    await db.run(`UPDATE project_comments SET content = ?, type = ? WHERE id = ?`, [
      content,
      typeRaw || existing.type,
      commentId
    ]);

    const updated = await db.get(
      `
      SELECT
        pc.id,
        pc.content,
        pc.type,
        pc.created_at AS createdAt,
        u.id AS userId,
        u.name AS userName
      FROM project_comments pc
      INNER JOIN users u ON u.id = pc.user_id
      WHERE pc.id = ?
      `,
      [commentId]
    );
    return res.json(updated);
  } catch (error) {
    return res.status(500).json({ message: "Erro ao editar comentario do projeto." });
  }
});

app.delete(
  "/api/projects/:projectId/comments/:commentId",
  authMiddleware,
  requireMembership,
  async (req, res) => {
    try {
      const commentId = Number(req.params.commentId);
      if (!commentId) return res.status(400).json({ message: "commentId invalido." });

      const existing = await db.get(
        `SELECT id, project_id AS projectId, user_id AS userId FROM project_comments WHERE id = ? AND project_id = ?`,
        [commentId, req.projectId]
      );
      if (!existing) return res.status(404).json({ message: "Comentario nao encontrado." });

      const canDelete = existing.userId === req.user.id || req.membership.role === "admin";
      if (!canDelete) {
        return res.status(403).json({ message: "Sem permissao para remover esse comentario." });
      }

      await db.run(`DELETE FROM project_comments WHERE id = ?`, [commentId]);
      return res.json({ message: "Comentario removido com sucesso." });
    } catch (error) {
      return res.status(500).json({ message: "Erro ao remover comentario do projeto." });
    }
  }
);

app.get("/api/tasks", authMiddleware, requireMembership, async (req, res) => {
  try {
    const { status, assignedTo } = req.query;
    const assignedToId = assignedTo ? Number(assignedTo) : null;

    const conditions = ["t.project_id = ?", "COALESCE(t.finalized, 0) = 0"];
    const params = [req.projectId];

    if (status) {
      conditions.push("t.status = ?");
      params.push(status);
    }

    if (assignedToId) {
      conditions.push("t.assigned_to = ?");
      params.push(assignedToId);
    }

    const tasks = await db.all(
      `
      SELECT
        t.id,
        t.project_id AS projectId,
        t.title,
        t.description,
        t.status,
        EXISTS(SELECT 1 FROM comments c_bug WHERE c_bug.task_id = t.id AND c_bug.type = 'bug') AS hasBugComment,
        EXISTS(SELECT 1 FROM comments c_block WHERE c_block.task_id = t.id AND c_block.type = 'bloqueado') AS hasBlockedComment,
        COALESCE(t.finalized, 0) AS finalized,
        t.finalized_at AS finalizedAt,
        t.assigned_to AS assignedTo,
        au.name AS assignedToName,
        t.created_by AS createdBy,
        cu.name AS createdByName,
        t.created_at AS createdAt,
        t.updated_at AS updatedAt
      FROM tasks t
      LEFT JOIN users au ON au.id = t.assigned_to
      INNER JOIN users cu ON cu.id = t.created_by
      WHERE ${conditions.join(" AND ")}
      ORDER BY t.created_at DESC
      `,
      params
    );

    return res.json(tasks);
  } catch (error) {
    return res.status(500).json({ message: "Erro ao listar tarefas." });
  }
});

app.get("/api/tasks/history", authMiddleware, requireMembership, async (req, res) => {
  try {
    const tasks = await db.all(
      `
      SELECT
        t.id,
        t.project_id AS projectId,
        t.title,
        t.description,
        t.status,
        COALESCE(t.finalized, 0) AS finalized,
        t.finalized_at AS finalizedAt,
        t.assigned_to AS assignedTo,
        au.name AS assignedToName,
        t.created_by AS createdBy,
        cu.name AS createdByName,
        t.created_at AS createdAt,
        t.updated_at AS updatedAt
      FROM tasks t
      LEFT JOIN users au ON au.id = t.assigned_to
      INNER JOIN users cu ON cu.id = t.created_by
      WHERE t.project_id = ? AND COALESCE(t.finalized, 0) = 1
      ORDER BY t.finalized_at DESC, t.updated_at DESC
      `,
      [req.projectId]
    );

    return res.json(tasks);
  } catch (error) {
    return res.status(500).json({ message: "Erro ao listar histórico de tarefas concluídas." });
  }
});

app.post("/api/tasks", authMiddleware, requireMembership, async (req, res) => {
  try {
    const title = normalizeText(req.body.title);
    const description = normalizeText(req.body.description);
    const taskStatus = normalizeText(req.body.status || "a_fazer");
    const assignedToRaw = req.body.assignedTo;
    const parsedAssignedTo =
      assignedToRaw === null || assignedToRaw === undefined || assignedToRaw === ""
        ? null
        : Number(assignedToRaw);

    if (!title) return res.status(400).json({ message: "title e obrigatorio." });
    if (!ensureSafeTextFields([title, description])) {
      return res.status(400).json({ message: "Texto contem caracteres nao permitidos." });
    }
    if (!hasMinLength(title, 15)) {
      return res.status(400).json({ message: "Titulo da tarefa deve ter no minimo 15 caracteres." });
    }
    if (!hasMinLength(description, 30)) {
      return res.status(400).json({ message: "Descricao da tarefa deve ter no minimo 30 caracteres." });
    }
    if (!ALLOWED_STATUS.includes(taskStatus)) {
      return res.status(400).json({ message: "Status invalido." });
    }

    if (parsedAssignedTo) {
      const assignedMember = await getProjectMembership(req.projectId, parsedAssignedTo);
      if (!assignedMember) {
        return res.status(400).json({ message: "Responsavel nao pertence ao projeto." });
      }
    }

    const result = await db.run(
      `
      INSERT INTO tasks (project_id, title, description, assigned_to, status, created_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ${SQL_NOW_BR}, ${SQL_NOW_BR})
      `,
      [req.projectId, title, description, parsedAssignedTo, taskStatus, req.user.id]
    );

    const task = await db.get(
      `
      SELECT
        t.id,
        t.project_id AS projectId,
        t.title,
        t.description,
        t.status,
        t.assigned_to AS assignedTo,
        au.name AS assignedToName,
        t.created_by AS createdBy,
        cu.name AS createdByName,
        t.created_at AS createdAt,
        t.updated_at AS updatedAt
      FROM tasks t
      LEFT JOIN users au ON au.id = t.assigned_to
      INNER JOIN users cu ON cu.id = t.created_by
      WHERE t.id = ?
      `,
      [result.lastID]
    );

    return res.status(201).json(task);
  } catch (error) {
    return res.status(500).json({ message: "Erro ao criar tarefa." });
  }
});

app.patch("/api/tasks/:taskId", authMiddleware, async (req, res) => {
  try {
    const taskId = Number(req.params.taskId);
    if (!taskId) return res.status(400).json({ message: "taskId invalido." });

    const existingTask = await db.get(`SELECT * FROM tasks WHERE id = ?`, [taskId]);
    if (!existingTask) return res.status(404).json({ message: "Tarefa nao encontrada." });

    const membership = await getProjectMembership(existingTask.project_id, req.user.id);
    if (!membership) return res.status(403).json({ message: "Voce nao faz parte desse projeto." });

    const titleProvided = Object.prototype.hasOwnProperty.call(req.body, "title");
    const descriptionProvided = Object.prototype.hasOwnProperty.call(req.body, "description");
    const statusProvided = Object.prototype.hasOwnProperty.call(req.body, "status");
    const assignedToProvided = Object.prototype.hasOwnProperty.call(req.body, "assignedTo");
    const finalizedProvided = Object.prototype.hasOwnProperty.call(req.body, "finalized");

    if (membership.role !== "admin" && (titleProvided || descriptionProvided || assignedToProvided)) {
      return res.status(403).json({ message: "Somente admins podem alterar configuracoes da tarefa." });
    }

    const title = titleProvided ? normalizeText(req.body.title) : null;
    const description = descriptionProvided ? normalizeText(req.body.description) : null;
    const status = statusProvided ? normalizeText(req.body.status) : null;
    const finalized = finalizedProvided ? Number(Boolean(req.body.finalized)) : null;

    let parsedAssignedTo = null;
    if (assignedToProvided) {
      const rawAssignedTo = req.body.assignedTo;
      parsedAssignedTo =
        rawAssignedTo === null || rawAssignedTo === "" || rawAssignedTo === undefined
          ? null
          : Number(rawAssignedTo);
    }

    if (titleProvided && !hasMinLength(title, 15)) {
      return res.status(400).json({ message: "Titulo da tarefa deve ter no minimo 15 caracteres." });
    }
    if (!ensureSafeTextFields([titleProvided ? title : "", descriptionProvided ? description : ""])) {
      return res.status(400).json({ message: "Texto contem caracteres nao permitidos." });
    }
    if (descriptionProvided && !hasMinLength(description, 30)) {
      return res.status(400).json({ message: "Descricao da tarefa deve ter no minimo 30 caracteres." });
    }
    if (statusProvided && !ALLOWED_STATUS.includes(status)) {
      return res.status(400).json({ message: "Status invalido." });
    }
    if (assignedToProvided && parsedAssignedTo) {
      const assignedMember = await getProjectMembership(existingTask.project_id, parsedAssignedTo);
      if (!assignedMember) {
        return res.status(400).json({ message: "Responsavel nao pertence ao projeto." });
      }
    }
    if (finalizedProvided) {
      const targetStatus = statusProvided ? status : existingTask.status;
      if (finalized === 1 && targetStatus !== "concluido") {
        return res
          .status(400)
          .json({ message: "Só é possível concluir definitivamente itens no status concluído." });
      }
    }

    await db.run(
      `
      UPDATE tasks
      SET
        title = COALESCE(?, title),
        description = COALESCE(?, description),
        status = COALESCE(?, status),
        assigned_to = CASE WHEN ? = 1 THEN ? ELSE assigned_to END,
        finalized = CASE WHEN ? = 1 THEN ? ELSE COALESCE(finalized, 0) END,
        finalized_at = CASE
          WHEN ? = 1 AND ? = 1 THEN ${SQL_NOW_BR}
          WHEN ? = 1 AND ? = 0 THEN NULL
          ELSE finalized_at
        END,
        updated_at = ${SQL_NOW_BR}
      WHERE id = ?
      `,
      [
        titleProvided ? title : null,
        descriptionProvided ? description : null,
        statusProvided ? status : null,
        assignedToProvided ? 1 : 0,
        assignedToProvided ? parsedAssignedTo : null,
        finalizedProvided ? 1 : 0,
        finalizedProvided ? finalized : 0,
        finalizedProvided ? 1 : 0,
        finalizedProvided ? finalized : 0,
        finalizedProvided ? 1 : 0,
        finalizedProvided ? finalized : 0,
        taskId
      ]
    );

    const task = await db.get(
      `
      SELECT
        t.id,
        t.project_id AS projectId,
        t.title,
        t.description,
        t.status,
        COALESCE(t.finalized, 0) AS finalized,
        t.finalized_at AS finalizedAt,
        t.assigned_to AS assignedTo,
        au.name AS assignedToName,
        t.created_by AS createdBy,
        cu.name AS createdByName,
        t.created_at AS createdAt,
        t.updated_at AS updatedAt
      FROM tasks t
      LEFT JOIN users au ON au.id = t.assigned_to
      INNER JOIN users cu ON cu.id = t.created_by
      WHERE t.id = ?
      `,
      [taskId]
    );

    return res.json(task);
  } catch (error) {
    return res.status(500).json({ message: "Erro ao atualizar tarefa." });
  }
});

app.delete("/api/tasks/:taskId", authMiddleware, async (req, res) => {
  try {
    const taskId = Number(req.params.taskId);
    if (!taskId) return res.status(400).json({ message: "taskId invalido." });

    const task = await db.get(`SELECT id, project_id AS projectId FROM tasks WHERE id = ?`, [taskId]);
    if (!task) return res.status(404).json({ message: "Tarefa nao encontrada." });

    const membership = await getProjectMembership(task.projectId, req.user.id);
    if (!membership) return res.status(403).json({ message: "Voce nao faz parte desse projeto." });
    if (membership.role !== "admin") {
      return res.status(403).json({ message: "Apenas admins podem excluir itens." });
    }

    await db.run(`DELETE FROM tasks WHERE id = ?`, [taskId]);
    return res.json({ message: "Item excluido com sucesso." });
  } catch (error) {
    return res.status(500).json({ message: "Erro ao excluir item." });
  }
});

app.get("/api/tasks/:taskId/comments", authMiddleware, async (req, res) => {
  try {
    const taskId = Number(req.params.taskId);
    if (!taskId) return res.status(400).json({ message: "taskId invalido." });

    const task = await db.get(`SELECT id, project_id FROM tasks WHERE id = ?`, [taskId]);
    if (!task) return res.status(404).json({ message: "Tarefa nao encontrada." });

    const membership = await getProjectMembership(task.project_id, req.user.id);
    if (!membership) return res.status(403).json({ message: "Voce nao faz parte desse projeto." });

    const comments = await db.all(
      `
      SELECT c.id, c.content, c.type, c.created_at AS createdAt, u.id AS userId, u.name AS userName
      FROM comments c
      INNER JOIN users u ON u.id = c.user_id
      WHERE c.task_id = ?
      ORDER BY c.created_at ASC
      `,
      [taskId]
    );

    return res.json(comments);
  } catch (error) {
    return res.status(500).json({ message: "Erro ao listar comentarios." });
  }
});

app.post("/api/tasks/:taskId/comments", authMiddleware, async (req, res) => {
  try {
    const taskId = Number(req.params.taskId);
    const content = normalizeText(req.body.content);
    const type = normalizeText(req.body.type || "anotacao");
    if (!taskId || !content) return res.status(400).json({ message: "taskId e content sao obrigatorios." });
    if (!ensureSafeTextFields([content])) {
      return res.status(400).json({ message: "Comentario contem caracteres nao permitidos." });
    }
    if (!hasMinLength(content, 20)) {
      return res.status(400).json({ message: "Comentario deve ter no minimo 20 caracteres." });
    }
    if (!ALLOWED_COMMENT_TYPES.includes(type)) {
      return res.status(400).json({ message: "Tipo de comentario invalido." });
    }

    const task = await db.get(`SELECT id, project_id FROM tasks WHERE id = ?`, [taskId]);
    if (!task) return res.status(404).json({ message: "Tarefa nao encontrada." });

    const membership = await getProjectMembership(task.project_id, req.user.id);
    if (!membership) return res.status(403).json({ message: "Voce nao faz parte desse projeto." });

    const result = await db.run(
      `INSERT INTO comments (task_id, user_id, content, type, created_at) VALUES (?, ?, ?, ?, ${SQL_NOW_BR})`,
      [taskId, req.user.id, content, type]
    );

    const comment = await db.get(
      `
      SELECT c.id, c.content, c.type, c.created_at AS createdAt, u.id AS userId, u.name AS userName
      FROM comments c
      INNER JOIN users u ON u.id = c.user_id
      WHERE c.id = ?
      `,
      [result.lastID]
    );

    return res.status(201).json(comment);
  } catch (error) {
    return res.status(500).json({ message: "Erro ao criar comentario." });
  }
});

app.patch("/api/tasks/:taskId/comments/:commentId", authMiddleware, async (req, res) => {
  try {
    const taskId = Number(req.params.taskId);
    const commentId = Number(req.params.commentId);
    const content = normalizeText(req.body.content);
    const typeRaw = Object.prototype.hasOwnProperty.call(req.body, "type")
      ? normalizeText(req.body.type)
      : null;
    if (!taskId || !commentId) {
      return res.status(400).json({ message: "taskId e commentId sao obrigatorios." });
    }
    if (!ensureSafeTextFields([content])) {
      return res.status(400).json({ message: "Comentario contem caracteres nao permitidos." });
    }
    if (!hasMinLength(content, 20)) {
      return res.status(400).json({ message: "Comentario deve ter no minimo 20 caracteres." });
    }
    if (typeRaw !== null && !ALLOWED_COMMENT_TYPES.includes(typeRaw)) {
      return res.status(400).json({ message: "Tipo de comentario invalido." });
    }

    const task = await db.get(`SELECT id, project_id FROM tasks WHERE id = ?`, [taskId]);
    if (!task) return res.status(404).json({ message: "Tarefa nao encontrada." });

    const membership = await getProjectMembership(task.project_id, req.user.id);
    if (!membership) return res.status(403).json({ message: "Voce nao faz parte desse projeto." });

    const existing = await db.get(
      `SELECT id, task_id AS taskId, user_id AS userId, type FROM comments WHERE id = ? AND task_id = ?`,
      [commentId, taskId]
    );
    if (!existing) return res.status(404).json({ message: "Comentario nao encontrado." });
    if (existing.userId !== req.user.id) {
      return res.status(403).json({ message: "Apenas o autor pode editar esse comentario." });
    }

    await db.run(`UPDATE comments SET content = ?, type = ? WHERE id = ?`, [
      content,
      typeRaw || existing.type,
      commentId
    ]);

    const updated = await db.get(
      `
      SELECT c.id, c.content, c.type, c.created_at AS createdAt, u.id AS userId, u.name AS userName
      FROM comments c
      INNER JOIN users u ON u.id = c.user_id
      WHERE c.id = ?
      `,
      [commentId]
    );
    return res.json(updated);
  } catch (error) {
    return res.status(500).json({ message: "Erro ao editar comentario." });
  }
});

app.delete("/api/tasks/:taskId/comments/:commentId", authMiddleware, async (req, res) => {
  try {
    const taskId = Number(req.params.taskId);
    const commentId = Number(req.params.commentId);
    if (!taskId || !commentId) {
      return res.status(400).json({ message: "taskId e commentId sao obrigatorios." });
    }

    const task = await db.get(`SELECT id, project_id FROM tasks WHERE id = ?`, [taskId]);
    if (!task) return res.status(404).json({ message: "Tarefa nao encontrada." });

    const membership = await getProjectMembership(task.project_id, req.user.id);
    if (!membership) return res.status(403).json({ message: "Voce nao faz parte desse projeto." });

    const existing = await db.get(
      `SELECT id, task_id AS taskId, user_id AS userId FROM comments WHERE id = ? AND task_id = ?`,
      [commentId, taskId]
    );
    if (!existing) return res.status(404).json({ message: "Comentario nao encontrado." });

    const canDelete = existing.userId === req.user.id || membership.role === "admin";
    if (!canDelete) {
      return res.status(403).json({ message: "Sem permissao para remover esse comentario." });
    }

    await db.run(`DELETE FROM comments WHERE id = ?`, [commentId]);
    return res.json({ message: "Comentario removido com sucesso." });
  } catch (error) {
    return res.status(500).json({ message: "Erro ao remover comentario." });
  }
});

app.get("/", (req, res) => res.sendFile(path.resolve(__dirname, "..", "public", "index.html")));
app.get("/login", (req, res) => res.sendFile(path.resolve(__dirname, "..", "public", "login.html")));
app.get("/register", (req, res) =>
  res.sendFile(path.resolve(__dirname, "..", "public", "register.html"))
);
app.get("/app", (req, res) => res.sendFile(path.resolve(__dirname, "..", "public", "app.html")));
app.get("/project", (req, res) =>
  res.sendFile(path.resolve(__dirname, "..", "public", "project.html"))
);
app.get("/project-create", (req, res) =>
  res.sendFile(path.resolve(__dirname, "..", "public", "project-create.html"))
);
app.get("*", (req, res) => res.redirect("/login"));

async function start() {
  db = await initDb();
  app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
  });
}

start();
