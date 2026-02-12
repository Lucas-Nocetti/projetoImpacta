const apiBase = "/api";
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const state = {
  token: localStorage.getItem("token") || "",
  user: JSON.parse(localStorage.getItem("user") || "null"),
  projectId: Number(new URLSearchParams(window.location.search).get("projectId")),
  project: null,
  users: [],
  tasks: [],
  selectedTask: null
};

if (!state.token) window.location.href = "/login";
if (!state.projectId) window.location.href = "/app";

const elements = {
  toast: document.getElementById("toast"),
  sessionArea: document.getElementById("session-area"),
  roleLabel: document.getElementById("project-role-label"),
  projectTitle: document.getElementById("project-title"),
  projectDescription: document.getElementById("project-description"),
  backToProjects: document.getElementById("back-to-projects"),
  openTaskCreate: document.getElementById("open-task-create"),
  openSettings: document.getElementById("open-settings"),
  openHistory: document.getElementById("open-history"),
  colAFazer: document.getElementById("col-a-fazer"),
  colFazendo: document.getElementById("col-fazendo"),
  colConcluido: document.getElementById("col-concluido"),
  taskModal: document.getElementById("task-modal"),
  closeTaskModal: document.getElementById("close-task-modal"),
  taskModalTitle: document.getElementById("task-modal-title"),
  taskModalDescription: document.getElementById("task-modal-description"),
  taskCommentForm: document.getElementById("task-comment-form"),
  taskCommentContent: document.getElementById("task-comment-content"),
  taskCommentsList: document.getElementById("task-comments-list"),
  taskCreateModal: document.getElementById("task-create-modal"),
  closeTaskCreateModal: document.getElementById("close-task-create-modal"),
  taskForm: document.getElementById("task-form"),
  taskAssignedTo: document.getElementById("task-assigned-to"),
  taskStatus: document.getElementById("task-status"),
  settingsModal: document.getElementById("settings-modal"),
  closeSettingsModal: document.getElementById("close-settings-modal"),
  historyModal: document.getElementById("history-modal"),
  closeHistoryModal: document.getElementById("close-history-modal"),
  historyList: document.getElementById("history-list"),
  adminConfigArea: document.getElementById("admin-config-area"),
  memberForm: document.getElementById("member-form"),
  memberEmail: document.getElementById("member-email"),
  memberRole: document.getElementById("member-role"),
  membersList: document.getElementById("members-list"),
  projectSettingsForm: document.getElementById("project-settings-form"),
  settingsProjectName: document.getElementById("settings-project-name"),
  settingsProjectDescription: document.getElementById("settings-project-description"),
  projectCommentForm: document.getElementById("project-comment-form"),
  projectCommentContent: document.getElementById("project-comment-content"),
  projectCommentsList: document.getElementById("project-comments-list")
};

function normalize(value) {
  return String(value || "").trim();
}

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

function openModal(modal) {
  modal.classList.remove("hidden");
  modal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
}

function closeModal(modal) {
  modal.classList.add("hidden");
  modal.setAttribute("aria-hidden", "true");
  if (document.querySelectorAll(".modal-overlay:not(.hidden)").length === 0) {
    document.body.classList.remove("modal-open");
  }
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

function renderProjectHeader() {
  elements.projectTitle.textContent = state.project?.name || "Projeto";
  elements.projectDescription.textContent = state.project?.description || "";
  elements.roleLabel.textContent =
    state.project?.role === "admin" ? "Perfil: Admin do projeto" : "Perfil: Usuário do projeto";
  elements.settingsProjectName.value = state.project?.name || "";
  elements.settingsProjectDescription.value = state.project?.description || "";

  if (state.project?.role === "admin") {
    elements.adminConfigArea.classList.remove("hidden");
  } else {
    elements.adminConfigArea.classList.add("hidden");
  }
}

function roleBadgeClass(role) {
  return role === "admin" ? "badge badge-admin" : "badge badge-member";
}

function renderMembers() {
  elements.membersList.innerHTML = "";
  state.users = state.project?.members || [];

  state.users.forEach((member) => {
    const li = document.createElement("li");
    li.innerHTML = `
      <strong>${member.name}</strong>
      <span>${member.email}</span>
      <span class="${roleBadgeClass(member.role)}">${member.role === "admin" ? "Admin" : "Usuário"}</span>
    `;

    if (state.project.role === "admin" && member.id !== state.user.id) {
      const toggleRoleButton = document.createElement("button");
      toggleRoleButton.type = "button";
      toggleRoleButton.textContent = member.role === "admin" ? "Tornar usuário" : "Tornar admin";
      toggleRoleButton.addEventListener("click", async () => {
        try {
          await request(`/projects/${state.projectId}/members/${member.id}`, {
            method: "PATCH",
            body: JSON.stringify({ role: member.role === "admin" ? "member" : "admin" })
          });
          showToast("Permissão atualizada.", "success");
          await loadProject();
        } catch (error) {
          showToast(error.message, "error");
        }
      });
      li.appendChild(toggleRoleButton);

      const removeButton = document.createElement("button");
      removeButton.type = "button";
      removeButton.className = "danger";
      removeButton.textContent = "Remover";
      removeButton.addEventListener("click", async () => {
        try {
          await request(`/projects/${state.projectId}/members/${member.id}`, {
            method: "DELETE"
          });
          showToast("Membro removido.", "success");
          await loadProject();
          await loadTasks();
        } catch (error) {
          showToast(error.message, "error");
        }
      });
      li.appendChild(removeButton);
    }

    elements.membersList.appendChild(li);
  });

  const userOptions = [`<option value="">Sem responsável</option>`]
    .concat(state.users.map((member) => `<option value="${member.id}">${member.name}</option>`))
    .join("");
  elements.taskAssignedTo.innerHTML = userOptions;
}

function nextStatus(current) {
  if (current === "a_fazer") return "fazendo";
  if (current === "fazendo") return "concluido";
  return "a_fazer";
}

function previousStatus(current) {
  if (current === "concluido") return "fazendo";
  if (current === "fazendo") return "a_fazer";
  return "a_fazer";
}

function findTaskById(taskId) {
  return state.tasks.find((task) => task.id === taskId) || null;
}

async function updateTaskStatus(taskId, targetStatus) {
  await request(`/tasks/${taskId}`, {
    method: "PATCH",
    body: JSON.stringify({ status: targetStatus })
  });
  showToast("Status atualizado.");
  await loadTasks();
}

async function finalizeTask(taskId) {
  await request(`/tasks/${taskId}`, {
    method: "PATCH",
    body: JSON.stringify({ finalized: true, status: "concluido" })
  });
  showToast("Item concluído e enviado para o histórico.");
  await loadTasks();
}

function buildTaskCard(task) {
  const li = document.createElement("li");
  li.className = "task-card";
  li.innerHTML = `
    <strong>${task.title}</strong>
    <span class="hint">${task.description}</span>
    <span class="status">${task.status.replace("_", " ")}</span>
    <span>Responsável: ${task.assignedToName || "Não definido"}</span>
  `;

  const actions = document.createElement("div");
  actions.className = "task-actions";

  const openBtn = document.createElement("button");
  openBtn.type = "button";
  openBtn.className = "btn-light";
  openBtn.textContent = "Abrir card";
  openBtn.addEventListener("click", async () => {
    await openTaskCard(task.id);
  });
  actions.appendChild(openBtn);

  const prevBtn = document.createElement("button");
  prevBtn.type = "button";
  prevBtn.textContent = "Voltar";
  prevBtn.disabled = task.status === "a_fazer";
  prevBtn.addEventListener("click", async () => {
    if (task.status === "a_fazer") return;
    try {
      await updateTaskStatus(task.id, previousStatus(task.status));
    } catch (error) {
      showToast(error.message, "error");
    }
  });
  actions.appendChild(prevBtn);

  const nextBtn = document.createElement("button");
  nextBtn.type = "button";
  nextBtn.textContent = task.status === "concluido" ? "Concluir" : "Avançar";
  nextBtn.addEventListener("click", async () => {
    try {
      if (task.status === "concluido") {
        await finalizeTask(task.id);
      } else {
        await updateTaskStatus(task.id, nextStatus(task.status));
      }
    } catch (error) {
      showToast(error.message, "error");
    }
  });
  actions.appendChild(nextBtn);

  li.appendChild(actions);
  return li;
}

function renderKanban() {
  elements.colAFazer.innerHTML = "";
  elements.colFazendo.innerHTML = "";
  elements.colConcluido.innerHTML = "";

  const map = {
    a_fazer: elements.colAFazer,
    fazendo: elements.colFazendo,
    concluido: elements.colConcluido
  };

  state.tasks.forEach((task) => {
    const list = map[task.status] || elements.colAFazer;
    list.appendChild(buildTaskCard(task));
  });
}

async function loadProject() {
  state.project = await request(`/projects/${state.projectId}`);
  renderProjectHeader();
  renderMembers();
}

async function loadTasks() {
  const query = new URLSearchParams({ projectId: String(state.projectId) });
  state.tasks = await request(`/tasks?${query.toString()}`);
  renderKanban();
}

async function loadHistory() {
  elements.historyList.innerHTML = "";
  const query = new URLSearchParams({ projectId: String(state.projectId) });
  const items = await request(`/tasks/history?${query.toString()}`);

  if (!items.length) {
    elements.historyList.innerHTML = `<li><span>Nenhum item concluído ainda.</span></li>`;
    return;
  }

  items.forEach((item) => {
    const li = document.createElement("li");
    li.innerHTML = `
      <strong>${item.title}</strong>
      <span>${item.description}</span>
      <span class="hint">Finalizado em: ${item.finalizedAt || "-"}</span>
      <span class="hint">Responsável: ${item.assignedToName || "Não definido"}</span>
    `;
    elements.historyList.appendChild(li);
  });
}

async function loadTaskComments(taskId) {
  elements.taskCommentsList.innerHTML = "";
  const comments = await request(`/tasks/${taskId}/comments`);
  comments.forEach((comment) => {
    const li = document.createElement("li");
    li.innerHTML = `
      <strong>${comment.userName}</strong>
      <span>${comment.content}</span>
    `;
    elements.taskCommentsList.appendChild(li);
  });
}

async function openTaskCard(taskId) {
  const task = findTaskById(taskId);
  if (!task) return;
  state.selectedTask = task;
  elements.taskModalTitle.textContent = task.title;
  elements.taskModalDescription.textContent = task.description;
  elements.taskCommentForm.reset();
  await loadTaskComments(task.id);
  openModal(elements.taskModal);
}

async function loadProjectComments() {
  elements.projectCommentsList.innerHTML = "";
  const comments = await request(`/projects/${state.projectId}/comments`);
  comments.forEach((comment) => {
    const li = document.createElement("li");
    li.innerHTML = `
      <strong>${comment.userName}</strong>
      <span>${comment.content}</span>
    `;
    elements.projectCommentsList.appendChild(li);
  });
}

elements.backToProjects.addEventListener("click", () => {
  window.location.href = "/app";
});

elements.openTaskCreate.addEventListener("click", () => {
  openModal(elements.taskCreateModal);
});

elements.openSettings.addEventListener("click", async () => {
  try {
    await loadProject();
    await loadProjectComments();
  } catch (error) {
    showToast(error.message, "error");
  }
  openModal(elements.settingsModal);
});

elements.openHistory.addEventListener("click", async () => {
  try {
    await loadHistory();
  } catch (error) {
    showToast(error.message, "error");
  }
  openModal(elements.historyModal);
});

elements.closeTaskModal.addEventListener("click", () => closeModal(elements.taskModal));
elements.closeTaskCreateModal.addEventListener("click", () => closeModal(elements.taskCreateModal));
elements.closeSettingsModal.addEventListener("click", () => closeModal(elements.settingsModal));
elements.closeHistoryModal.addEventListener("click", () => closeModal(elements.historyModal));

elements.taskModal.addEventListener("click", (event) => {
  if (event.target === elements.taskModal) closeModal(elements.taskModal);
});
elements.taskCreateModal.addEventListener("click", (event) => {
  if (event.target === elements.taskCreateModal) closeModal(elements.taskCreateModal);
});
elements.settingsModal.addEventListener("click", (event) => {
  if (event.target === elements.settingsModal) closeModal(elements.settingsModal);
});
elements.historyModal.addEventListener("click", (event) => {
  if (event.target === elements.historyModal) closeModal(elements.historyModal);
});

elements.taskForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const title = normalize(document.getElementById("task-title-input").value);
  const description = normalize(document.getElementById("task-description-input").value);
  const assignedTo = elements.taskAssignedTo.value || null;
  const status = elements.taskStatus.value;

  if (title.length < 15) return showToast("Título deve ter no mínimo 15 caracteres.", "error");
  if (description.length < 30) return showToast("Descrição deve ter no mínimo 30 caracteres.", "error");

  try {
    await request("/tasks", {
      method: "POST",
      body: JSON.stringify({ projectId: state.projectId, title, description, assignedTo, status })
    });
    elements.taskForm.reset();
    showToast("Item criado.", "success");
    closeModal(elements.taskCreateModal);
    await loadTasks();
  } catch (error) {
    showToast(error.message, "error");
  }
});

elements.taskCommentForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!state.selectedTask) return showToast("Selecione um item.", "error");
  const content = normalize(elements.taskCommentContent.value);
  if (content.length < 20) return showToast("Comentário deve ter no mínimo 20 caracteres.", "error");

  try {
    await request(`/tasks/${state.selectedTask.id}/comments`, {
      method: "POST",
      body: JSON.stringify({ content })
    });
    elements.taskCommentForm.reset();
    showToast("Comentário adicionado.", "success");
    await loadTaskComments(state.selectedTask.id);
  } catch (error) {
    showToast(error.message, "error");
  }
});

elements.memberForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const email = normalize(elements.memberEmail.value).toLowerCase();
  const role = elements.memberRole.value;
  if (!EMAIL_REGEX.test(email)) return showToast("E-mail inválido.", "error");

  try {
    await request(`/projects/${state.projectId}/members`, {
      method: "POST",
      body: JSON.stringify({ email, role })
    });
    elements.memberForm.reset();
    showToast("Membro atualizado.", "success");
    await loadProject();
  } catch (error) {
    showToast(error.message, "error");
  }
});

elements.projectSettingsForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const name = normalize(elements.settingsProjectName.value);
  const description = normalize(elements.settingsProjectDescription.value);
  if (!name) return showToast("Nome do projeto é obrigatório.", "error");
  if (description.length < 30) return showToast("Descrição do projeto deve ter no mínimo 30 caracteres.", "error");

  try {
    await request(`/projects/${state.projectId}`, {
      method: "PATCH",
      body: JSON.stringify({ name, description })
    });
    showToast("Configurações atualizadas.", "success");
    await loadProject();
  } catch (error) {
    showToast(error.message, "error");
  }
});

elements.projectCommentForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const content = normalize(elements.projectCommentContent.value);
  if (content.length < 20) return showToast("Comentário deve ter no mínimo 20 caracteres.", "error");

  try {
    await request(`/projects/${state.projectId}/comments`, {
      method: "POST",
      body: JSON.stringify({ content })
    });
    elements.projectCommentForm.reset();
    showToast("Comentário do projeto adicionado.", "success");
    await loadProjectComments();
  } catch (error) {
    showToast(error.message, "error");
  }
});

async function bootstrap() {
  renderSession();
  try {
    await loadProject();
    await loadTasks();
  } catch (error) {
    showToast(error.message, "error");
    if (String(error.message || "").toLowerCase().includes("token")) clearSession();
  }
}

bootstrap();
