const apiBase = "/api";

const state = {
  token: localStorage.getItem("token") || "",
  user: JSON.parse(localStorage.getItem("user") || "null"),
  projects: []
};

if (!state.token) window.location.href = "/login";

const elements = {
  sessionArea: document.getElementById("session-area"),
  projectsGrid: document.getElementById("projects-grid"),
  goCreateProject: document.getElementById("go-create-project"),
  toast: document.getElementById("toast")
};

let toastTimer;
function showToast(message, type = "info") {
  elements.toast.textContent = message;
  elements.toast.classList.remove("toast-success", "toast-error", "toast-info", "show");
  elements.toast.classList.add(`toast-${type}`);
  elements.toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => elements.toast.classList.remove("show"), 2600);
}

function clearSession() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  window.location.href = "/login";
}

async function request(path, options = {}) {
  const headers = options.headers || {};
  headers["Content-Type"] = "application/json";
  headers.Authorization = `Bearer ${state.token}`;

  const response = await fetch(`${apiBase}${path}`, { ...options, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "Erro na requisição");
  return data;
}

function renderSession() {
  elements.sessionArea.innerHTML = `
    <span>${state.user?.name || ""} (${state.user?.email || ""})</span>
    <button id="logout-btn" class="danger">Sair</button>
  `;
  document.getElementById("logout-btn").addEventListener("click", clearSession);
}

function roleLabel(role) {
  return role === "admin" ? "Admin" : "Usuário";
}

function roleBadgeClass(role) {
  return role === "admin" ? "badge badge-admin" : "badge badge-member";
}

function renderProjects() {
  elements.projectsGrid.innerHTML = "";
  if (!state.projects.length) {
    elements.projectsGrid.innerHTML = `<div class="card"><p>Nenhum projeto vinculado ainda.</p></div>`;
    return;
  }

  state.projects.forEach((project) => {
    const projectId = Number(project.id ?? project.projectId);
    if (!Number.isFinite(projectId) || projectId <= 0) return;

    const card = document.createElement("a");
    card.className = "project-card";
    card.href = `/project?projectId=${projectId}`;
    card.innerHTML = `
      <strong>${project.name}</strong>
      <span>${project.description}</span>
      <span class="${roleBadgeClass(project.role)}">${roleLabel(project.role)}</span>
      <span class="hint">${project.taskCount || 0} itens vinculados</span>
    `;
    card.addEventListener("click", (event) => {
      event.preventDefault();
      window.location.assign(`/project?projectId=${projectId}`);
    });
    elements.projectsGrid.appendChild(card);
  });
}

async function loadProjects() {
  state.projects = await request("/projects");
  renderProjects();
}

if (elements.goCreateProject) elements.goCreateProject.href = "/project-create";

async function bootstrap() {
  renderSession();
  try {
    await loadProjects();
  } catch (error) {
    showToast(error.message, "error");
    clearSession();
  }
}

bootstrap();
