const apiBase = "/api";
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const state = {
  token: localStorage.getItem("token") || "",
  user: JSON.parse(localStorage.getItem("user") || "null"),
  projectId: Number(new URLSearchParams(window.location.search).get("projectId")),
  openTarget: new URLSearchParams(window.location.search).get("open") || "",
  project: null,
  users: [],
  tasks: [],
  selectedTask: null,
  editingTaskCommentId: null,
  editingProjectCommentId: null,
  taskPendingDelete: null,
  editingTaskId: null,
  memberPendingDelete: null,
  blockingConfirmResolver: null,
  lastFocusedElement: null
};
const DRAG_TASK_MIME = "application/x-task-id";

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
  taskSettingsForm: document.getElementById("task-settings-form"),
  taskSettingsAssignedTo: document.getElementById("task-settings-assigned-to"),
  taskSettingsHint: document.getElementById("task-settings-hint"),
  taskCommentForm: document.getElementById("task-comment-form"),
  taskCommentType: document.getElementById("task-comment-type"),
  taskCommentContent: document.getElementById("task-comment-content"),
  taskCommentsList: document.getElementById("task-comments-list"),
  taskCreateModal: document.getElementById("task-create-modal"),
  taskCreateModalTitle: document.getElementById("task-create-modal-title"),
  closeTaskCreateModal: document.getElementById("close-task-create-modal"),
  taskForm: document.getElementById("task-form"),
  taskSubmitBtn: document.getElementById("task-submit-btn"),
  taskAssignedTo: document.getElementById("task-assigned-to"),
  taskStatus: document.getElementById("task-status"),
  settingsModal: document.getElementById("settings-modal"),
  closeSettingsModal: document.getElementById("close-settings-modal"),
  historyModal: document.getElementById("history-modal"),
  closeHistoryModal: document.getElementById("close-history-modal"),
  deleteTaskModal: document.getElementById("delete-task-modal"),
  closeDeleteTaskModal: document.getElementById("close-delete-task-modal"),
  cancelDeleteTask: document.getElementById("cancel-delete-task"),
  confirmDeleteTask: document.getElementById("confirm-delete-task"),
  deleteTaskMessage: document.getElementById("delete-task-message"),
  deleteMemberModal: document.getElementById("delete-member-modal"),
  closeDeleteMemberModal: document.getElementById("close-delete-member-modal"),
  cancelDeleteMember: document.getElementById("cancel-delete-member"),
  confirmDeleteMember: document.getElementById("confirm-delete-member"),
  deleteMemberMessage: document.getElementById("delete-member-message"),
  blockingConfirmModal: document.getElementById("blocking-confirm-modal"),
  closeBlockingConfirmModal: document.getElementById("close-blocking-confirm-modal"),
  cancelBlockingConfirm: document.getElementById("cancel-blocking-confirm"),
  confirmBlockingConfirm: document.getElementById("confirm-blocking-confirm"),
  blockingConfirmMessage: document.getElementById("blocking-confirm-message"),
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
  projectCommentType: document.getElementById("project-comment-type"),
  projectCommentContent: document.getElementById("project-comment-content"),
  projectCommentsList: document.getElementById("project-comments-list"),
  logoutModal: document.getElementById("logout-modal"),
  closeLogoutModal: document.getElementById("close-logout-modal"),
  cancelLogout: document.getElementById("cancel-logout"),
  confirmLogout: document.getElementById("confirm-logout")
};

function normalize(value) {
  return String(value || "").trim();
}

function commentTypeLabel(type) {
  if (type === "bug") return "Bug";
  if (type === "melhoria") return "Melhoria";
  if (type === "bloqueado") return "Bloqueado";
  return "Anotacao";
}

function formatDateTime(value) {
  if (!value) return "-";
  const sqliteDateTimePattern = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;
  if (sqliteDateTimePattern.test(value)) {
    const utcDate = new Date(value.replace(" ", "T") + "Z");
    if (!Number.isNaN(utcDate.getTime())) {
      return utcDate.toLocaleString("pt-BR", {
        dateStyle: "short",
        timeStyle: "short",
        timeZone: "America/Sao_Paulo"
      });
    }
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo"
  });
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
  state.lastFocusedElement = document.activeElement;
  modal.classList.remove("hidden");
  modal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
  const firstFocusable = modal.querySelector("button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])");
  if (firstFocusable) firstFocusable.focus();
}

function closeModal(modal) {
  modal.classList.add("hidden");
  modal.setAttribute("aria-hidden", "true");
  if (document.querySelectorAll(".modal-overlay:not(.hidden)").length === 0) {
    document.body.classList.remove("modal-open");
    if (state.lastFocusedElement && typeof state.lastFocusedElement.focus === "function") {
      state.lastFocusedElement.focus();
    }
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
    <div class="session-user">
      <span class="session-name">${state.user?.name || ""}</span>
      <span class="session-email">${state.user?.email || ""}</span>
    </div>
    <button id="logout-btn" class="danger" aria-label="Encerrar sess\u00e3o" title="Encerrar sess\u00e3o">Sair</button>
  `;
  document.getElementById("logout-btn").addEventListener("click", () => openModal(elements.logoutModal));
}

function renderProjectHeader() {
  elements.projectTitle.textContent = state.project?.name || "Projeto";
  elements.projectDescription.textContent = state.project?.description || "";
  elements.roleLabel.textContent =
    state.project?.role === "admin" ? "Perfil: Admin do projeto" : "Perfil: Usu\u00e1rio do projeto";
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
      <span class="${roleBadgeClass(member.role)}">${member.role === "admin" ? "Admin" : "Usu\u00e1rio"}</span>
    `;

    if (state.project?.role === "admin" && member.id !== state.user?.id) {
      const toggleRoleButton = document.createElement("button");
      toggleRoleButton.type = "button";
      toggleRoleButton.textContent = member.role === "admin" ? "Tornar usu\u00e1rio" : "Tornar admin";
      toggleRoleButton.setAttribute(
        "aria-label",
        member.role === "admin"
          ? `Alterar ${member.name} para usuario`
          : `Alterar ${member.name} para admin`
      );
      toggleRoleButton.title =
        member.role === "admin"
          ? `Alterar ${member.name} para usuario`
          : `Alterar ${member.name} para admin`;
      toggleRoleButton.addEventListener("click", async () => {
        try {
          await request(`/projects/${state.projectId}/members/${member.id}`, {
            method: "PATCH",
            body: JSON.stringify({ role: member.role === "admin" ? "member" : "admin" })
          });
          showToast("Permiss\u00e3o atualizada.", "success");
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
      removeButton.setAttribute("aria-label", `Remover membro ${member.name}`);
      removeButton.title = `Remover membro ${member.name}`;
      removeButton.addEventListener("click", () => {
        openDeleteMemberModal(member);
      });
      li.appendChild(removeButton);
    }

    elements.membersList.appendChild(li);
  });

  const userOptions = [`<option value="">Sem respons\u00e1vel</option>`]
    .concat(state.users.map((member) => `<option value="${member.id}">${member.name}</option>`))
    .join("");
  elements.taskAssignedTo.innerHTML = userOptions;
  elements.taskSettingsAssignedTo.innerHTML = userOptions;
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

function statusLabel(status) {
  if (status === "a_fazer") return "A fazer";
  if (status === "fazendo") return "Fazendo";
  if (status === "concluido") return "Conclu\u00eddo";
  return status || "-";
}

function statusClass(status) {
  if (status === "a_fazer") return "status status-a-fazer";
  if (status === "fazendo") return "status status-fazendo";
  if (status === "concluido") return "status status-concluido";
  return "status";
}

function findTaskById(taskId) {
  return state.tasks.find((task) => task.id === taskId) || null;
}

function hasBlockingFlags(task) {
  if (!task) return false;
  return Number(task.hasBugComment) > 0 || Number(task.hasBlockedComment) > 0;
}

function blockingFlagsLabel(task) {
  const labels = [];
  if (Number(task.hasBlockedComment) > 0) labels.push("blocker");
  if (Number(task.hasBugComment) > 0) labels.push("bug");
  if (!labels.length) return "";
  if (labels.length === 1) return labels[0];
  return `${labels[0]} e ${labels[1]}`;
}

function resolveBlockingConfirm(result) {
  if (typeof state.blockingConfirmResolver !== "function") return;
  const resolve = state.blockingConfirmResolver;
  state.blockingConfirmResolver = null;
  resolve(result);
}

function resetBlockingConfirmModal(result = false) {
  resolveBlockingConfirm(result);
  closeModal(elements.blockingConfirmModal);
}

async function confirmBlockedOrBugConclusion(task) {
  if (!hasBlockingFlags(task)) return true;
  if (typeof state.blockingConfirmResolver === "function") {
    state.blockingConfirmResolver(false);
    state.blockingConfirmResolver = null;
  }
  const labels = blockingFlagsLabel(task);
  elements.blockingConfirmMessage.textContent = `O card possui ${labels} vinculado. Deseja concluir mesmo assim`;
  openModal(elements.blockingConfirmModal);
  return new Promise((resolve) => {
    state.blockingConfirmResolver = resolve;
  });
}

function openTaskCreateForStatus(status) {
  state.editingTaskId = null;
  elements.taskForm.reset();
  elements.taskCreateModalTitle.textContent = "Novo item";
  elements.taskSubmitBtn.textContent = "Criar item";
  elements.taskSubmitBtn.setAttribute("aria-label", "Criar item");
  elements.taskSubmitBtn.title = "Criar item";
  elements.taskStatus.value = status;
  openModal(elements.taskCreateModal);
}

function openTaskEdit(task) {
  state.editingTaskId = task.id;
  elements.taskCreateModalTitle.textContent = "Editar item";
  elements.taskSubmitBtn.textContent = "Salvar alterações";
  elements.taskSubmitBtn.setAttribute("aria-label", "Salvar alterações do item");
  elements.taskSubmitBtn.title = "Salvar alterações do item";
  document.getElementById("task-title-input").value = task.title || "";
  document.getElementById("task-description-input").value = task.description || "";
  elements.taskAssignedTo.value = task.assignedTo ? String(task.assignedTo) : "";
  elements.taskStatus.value = task.status || "a_fazer";
  openModal(elements.taskCreateModal);
}

async function updateTaskStatus(taskId, targetStatus) {
  const task = findTaskById(taskId);
  if (targetStatus === "concluido" && !(await confirmBlockedOrBugConclusion(task))) return;
  await request(`/tasks/${taskId}`, {
    method: "PATCH",
    body: JSON.stringify({ status: targetStatus })
  });
  showToast("Status atualizado.");
  await loadTasks();
}

async function finalizeTask(taskId) {
  const task = findTaskById(taskId);
  if (!(await confirmBlockedOrBugConclusion(task))) return;
  await request(`/tasks/${taskId}`, {
    method: "PATCH",
    body: JSON.stringify({ finalized: true, status: "concluido" })
  });
  showToast("Item conclu\u00eddo e enviado para o hist\u00f3rico.");
  await loadTasks();
}

async function deleteTask(taskId) {
  await request(`/tasks/${taskId}`, {
    method: "DELETE"
  });
  showToast("Item excluído com sucesso.", "success");
  await loadTasks();
}

function openDeleteTaskModal(task) {
  state.taskPendingDelete = { id: task.id, title: task.title };
  elements.deleteTaskMessage.textContent = `Tem certeza que deseja excluir o item "${task.title}"? Essa ação não pode ser desfeita.`;
  openModal(elements.deleteTaskModal);
}

function resetDeleteTaskModal() {
  state.taskPendingDelete = null;
  closeModal(elements.deleteTaskModal);
}

function openDeleteMemberModal(member) {
  state.memberPendingDelete = { id: member.id, name: member.name };
  elements.deleteMemberMessage.textContent = `Tem certeza que deseja remover "${member.name}" deste projeto`;
  openModal(elements.deleteMemberModal);
}

function resetDeleteMemberModal() {
  state.memberPendingDelete = null;
  closeModal(elements.deleteMemberModal);
}

function resetTaskFormMode() {
  state.editingTaskId = null;
  elements.taskCreateModalTitle.textContent = "Novo item";
  elements.taskSubmitBtn.textContent = "Criar item";
  elements.taskSubmitBtn.setAttribute("aria-label", "Criar item");
  elements.taskSubmitBtn.title = "Criar item";
}

function buildTaskCard(task) {
  const li = document.createElement("li");
  li.className = "task-card";
  li.draggable = true;
  li.dataset.taskId = String(task.id);
  li.addEventListener("dragstart", (event) => {
    event.dataTransfer.setData(DRAG_TASK_MIME, String(task.id));
    event.dataTransfer.effectAllowed = "move";
    li.classList.add("is-dragging");
  });
  li.addEventListener("dragend", () => {
    li.classList.remove("is-dragging");
  });
  li.innerHTML = `
    <strong>${task.title}</strong>
    <span class="hint">${task.description}</span>
    <span class="${statusClass(task.status)}">${statusLabel(task.status)}</span>
    <span>Respons\u00e1vel: ${task.assignedToName || "N\u00e3o definido"}</span>
  `;

  const flags = document.createElement("div");
  flags.className = "task-flags";
  if (Number(task.hasBugComment) > 0) {
    flags.innerHTML += `<span class="task-flag task-flag-bug">Bug</span>`;
  }
  if (Number(task.hasBlockedComment) > 0) {
    flags.innerHTML += `<span class="task-flag task-flag-blocked">Bloqueado</span>`;
  }
  if (flags.innerHTML) li.appendChild(flags);

  const actions = document.createElement("div");
  actions.className = "task-actions";

  const tools = document.createElement("div");
  tools.className = "task-card-tools";

  const openBtn = document.createElement("button");
  openBtn.type = "button";
  openBtn.className = "btn-light btn-open-card btn-open-card-icon btn-ghost-icon";
  openBtn.innerHTML = `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 17L17 7"></path>
      <path d="M9 7H17V15"></path>
    </svg>
  `;
  openBtn.setAttribute("aria-label", `Abrir card do item ${task.title}`);
  openBtn.title = `Abrir card do item ${task.title}`;
  openBtn.addEventListener("click", async () => {
    await openTaskCard(task.id);
  });
  tools.appendChild(openBtn);

  if (state.project.role === "admin") {
    const menu = document.createElement("details");
    menu.className = "task-menu";
    const trigger = document.createElement("summary");
    trigger.className = "btn-icon task-menu-trigger";
    trigger.setAttribute("aria-label", `Ações do item ${task.title}`);
    trigger.title = `Ações do item ${task.title}`;
    trigger.innerHTML = `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 4.8A1.5 1.5 0 1 0 12 7.8A1.5 1.5 0 0 0 12 4.8Z"></path>
        <path d="M12 10.5A1.5 1.5 0 1 0 12 13.5A1.5 1.5 0 0 0 12 10.5Z"></path>
        <path d="M12 16.2A1.5 1.5 0 1 0 12 19.2A1.5 1.5 0 0 0 12 16.2Z"></path>
      </svg>
    `;
    menu.appendChild(trigger);

    const panel = document.createElement("div");
    panel.className = "task-menu-panel";

    const editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.className = "task-menu-item";
    editBtn.title = `Editar item ${task.title}`;
    editBtn.setAttribute("aria-label", `Editar item ${task.title}`);
    editBtn.innerHTML = `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 20H8L18 10L14 6L4 16V20Z"></path>
        <path d="M12.5 7.5L16.5 11.5"></path>
      </svg>
      <span>Editar</span>
    `;
    editBtn.addEventListener("click", () => {
      menu.open = false;
      openTaskEdit(task);
    });
    panel.appendChild(editBtn);

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "task-menu-item is-danger";
    deleteBtn.title = `Excluir item ${task.title}`;
    deleteBtn.innerHTML = `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 7H20"></path>
        <path d="M9 7V5H15V7"></path>
        <path d="M8 7L9 19H15L16 7"></path>
      </svg>
      <span>Excluir</span>
    `;
    deleteBtn.addEventListener("click", async () => {
      menu.open = false;
      openDeleteTaskModal(task);
    });
    panel.appendChild(deleteBtn);
    menu.appendChild(panel);
    tools.appendChild(menu);
  }

  li.appendChild(tools);

  const prevBtn = document.createElement("button");
  prevBtn.type = "button";
  prevBtn.className = "btn-arrow btn-icon-only";
  prevBtn.innerHTML = `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M15 18L9 12L15 6"></path>
    </svg>
  `;
  prevBtn.setAttribute("aria-label", `Mover item ${task.title} para a etapa anterior`);
  prevBtn.title = `Mover item ${task.title} para a etapa anterior`;
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
  nextBtn.className = "btn-arrow btn-icon-only";
  nextBtn.innerHTML =
    task.status === "concluido"
      ? `
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M5 12L10 17L19 8"></path>
        </svg>
      `
      : `
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M9 18L15 12L9 6"></path>
        </svg>
      `;
  nextBtn.setAttribute(
    "aria-label",
    task.status === "concluido"
      ? `Concluir definitivamente item ${task.title}`
      : `Avan\u00e7ar item ${task.title} para a pr\u00f3xima etapa`
  );
  nextBtn.title =
    task.status === "concluido"
      ? `Concluir definitivamente item ${task.title}`
      : `Avan\u00e7ar item ${task.title} para a pr\u00f3xima etapa`;
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

  renderColumnCreateActions();
}

function renderColumnCreateActions() {
  const columns = [
    { list: elements.colAFazer, status: "a_fazer" },
    { list: elements.colFazendo, status: "fazendo" },
    { list: elements.colConcluido, status: "concluido" }
  ];

  columns.forEach(({ list, status }) => {
    const column = list.closest(".kanban-column");
    if (!column) return;

    const prevEmptyButton = column.querySelector(".column-create-empty");
    if (prevEmptyButton) prevEmptyButton.remove();

    const hasTaskCards = list.querySelector(".task-card") !== null;
    if (hasTaskCards) {
      const slot = document.createElement("li");
      slot.className = "task-create-slot";
      const button = document.createElement("button");
      button.type = "button";
      button.className = "btn-light column-create-inline";
      button.textContent = "Criar novo item";
      button.setAttribute("aria-label", `Criar novo item na coluna ${statusLabel(status)}`);
      button.title = `Criar novo item na coluna ${statusLabel(status)}`;
      button.addEventListener("click", () => openTaskCreateForStatus(status));
      slot.appendChild(button);
      list.appendChild(slot);
      return;
    }

    const iconButton = document.createElement("button");
    iconButton.type = "button";
    iconButton.className = "btn-light icon-only-btn column-create-empty";
    iconButton.setAttribute("aria-label", `Criar novo item na coluna ${statusLabel(status)}`);
    iconButton.title = `Criar novo item na coluna ${statusLabel(status)}`;
    iconButton.innerHTML = `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 5V19M5 12H19"></path>
      </svg>
    `;
    iconButton.addEventListener("click", () => openTaskCreateForStatus(status));
    column.appendChild(iconButton);
  });
}

function setupKanbanDragAndDrop() {
  const columns = [
    { list: elements.colAFazer, status: "a_fazer" },
    { list: elements.colFazendo, status: "fazendo" },
    { list: elements.colConcluido, status: "concluido" }
  ];

  columns.forEach(({ list, status }) => {
    list.dataset.status = status;
    list.setAttribute("aria-label", `Coluna ${statusLabel(status)}`);
    list.addEventListener("dragover", (event) => {
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
    });
    list.addEventListener("dragenter", () => list.classList.add("drag-over"));
    list.addEventListener("dragleave", (event) => {
      if (!list.contains(event.relatedTarget)) list.classList.remove("drag-over");
    });
    list.addEventListener("drop", async (event) => {
      event.preventDefault();
      list.classList.remove("drag-over");
      const taskId = Number(event.dataTransfer.getData(DRAG_TASK_MIME));
      const droppedTask = findTaskById(taskId);
      if (!droppedTask || droppedTask.status === status) return;
      try {
        await updateTaskStatus(taskId, status);
      } catch (error) {
        showToast(error.message, "error");
      }
    });
  });
}

async function loadProject() {
  state.project = await request(`/projects/${state.projectId}`);
  renderProjectHeader();
  renderMembers();
}

async function loadTasks() {
  const query = new URLSearchParams({ projectId: String(state.projectId) });
  state.tasks = await request(`/tasks${query.toString()}`);
  renderKanban();
}

async function loadHistory() {
  elements.historyList.innerHTML = "";
  const query = new URLSearchParams({ projectId: String(state.projectId) });
  const items = await request(`/tasks/history${query.toString()}`);

  if (!items.length) {
    elements.historyList.innerHTML = `<li><span>Nenhum item conclu\u00eddo ainda.</span></li>`;
    return;
  }

  items.forEach((item) => {
    const li = document.createElement("li");
    li.innerHTML = `
      <strong>${item.title}</strong>
      <span>${item.description}</span>
      <span class="hint">Finalizado em: ${formatDateTime(item.finalizedAt)}</span>
      <span class="hint">Respons\u00e1vel: ${item.assignedToName || "N\u00e3o definido"}</span>
    `;
    elements.historyList.appendChild(li);
  });
}

function isProjectAdmin() {
  return state.project.role === "admin";
}

function canEditComment(comment) {
  return Number(comment.userId) === Number(state.user.id);
}

function canDeleteComment(comment) {
  return canEditComment(comment) || isProjectAdmin();
}

function createIconActionButton({ icon, label, className = "", onClick }) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `btn-icon btn-comment-action ${className}`.trim();
  button.innerHTML = `<span aria-hidden="true">${icon}</span>`;
  button.setAttribute("aria-label", label);
  button.title = label;
  button.addEventListener("click", onClick);
  return button;
}

function createCommentMenu({ userName, onEdit, onDelete, canEdit, canDelete }) {
  const details = document.createElement("details");
  details.className = "comment-menu";

  const summary = document.createElement("summary");
  summary.className = "btn-icon comment-menu-trigger";
  summary.setAttribute("aria-label", `Abrir ações do comentário de ${userName}`);
  summary.title = `Abrir ações do comentário de ${userName}`;
  summary.innerHTML = `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 4.8A1.5 1.5 0 1 0 12 7.8A1.5 1.5 0 0 0 12 4.8Z"></path>
      <path d="M12 10.5A1.5 1.5 0 1 0 12 13.5A1.5 1.5 0 0 0 12 10.5Z"></path>
      <path d="M12 16.2A1.5 1.5 0 1 0 12 19.2A1.5 1.5 0 0 0 12 16.2Z"></path>
    </svg>
  `;
  details.appendChild(summary);

  const panel = document.createElement("div");
  panel.className = "comment-menu-panel";

  if (canEdit) {
    const editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.className = "comment-menu-item";
    editBtn.innerHTML = `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 20H8L18 10L14 6L4 16V20Z"></path>
        <path d="M12.5 7.5L16.5 11.5"></path>
      </svg>
      <span>Editar</span>
    `;
    editBtn.setAttribute("aria-label", `Editar comentário de ${userName}`);
    editBtn.title = `Editar comentário de ${userName}`;
    editBtn.addEventListener("click", async () => {
      details.open = false;
      await onEdit();
    });
    panel.appendChild(editBtn);
  }

  if (canDelete) {
    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "comment-menu-item is-danger";
    deleteBtn.innerHTML = `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 7H20"></path>
        <path d="M9 7V5H15V7"></path>
        <path d="M8 7L9 19H15L16 7"></path>
      </svg>
      <span>Excluir</span>
    `;
    deleteBtn.setAttribute("aria-label", `Excluir comentário de ${userName}`);
    deleteBtn.title = `Excluir comentário de ${userName}`;
    deleteBtn.addEventListener("click", async () => {
      details.open = false;
      await onDelete();
    });
    panel.appendChild(deleteBtn);
  }

  if (panel.children.length) {
    details.appendChild(panel);
  }

  return details;
}

async function editTaskComment(comment) {
  state.editingTaskCommentId = comment.id;
  await loadTaskComments(state.selectedTask.id);
}

async function deleteTaskComment(comment) {
  if (!window.confirm("Deseja remover este comentário")) return;
  try {
    await request(`/tasks/${state.selectedTask.id}/comments/${comment.id}`, {
      method: "DELETE"
    });
    showToast("Coment\u00e1rio removido.", "success");
    await loadTaskComments(state.selectedTask.id);
    await loadTasks();
  } catch (error) {
    showToast(error.message, "error");
  }
}

async function editProjectComment(comment) {
  state.editingProjectCommentId = comment.id;
  await loadProjectComments();
}

function createCommentEditForm(comment, { onSave, onCancel }) {
  const form = document.createElement("form");
  form.className = "comment-edit-form";

  const typeSelect = document.createElement("select");
  typeSelect.required = true;
  typeSelect.innerHTML = `
    <option value="anotacao">Anotação</option>
    <option value="melhoria">Melhoria</option>
    <option value="bug">Bug</option>
    <option value="bloqueado">Bloqueado</option>
  `;
  typeSelect.value = comment.type || "anotacao";
  form.appendChild(typeSelect);

  const textarea = document.createElement("textarea");
  textarea.required = true;
  textarea.minLength = 20;
  textarea.value = comment.content || "";
  textarea.placeholder = "Edite o comentário";
  form.appendChild(textarea);

  const actions = document.createElement("div");
  actions.className = "comment-edit-actions";

  const saveBtn = document.createElement("button");
  saveBtn.type = "submit";
  saveBtn.className = "btn-light comment-edit-icon comment-edit-save";
  saveBtn.innerHTML = `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 4H16L19 7V20H5V4Z"></path>
      <path d="M8 4V10H15V4"></path>
      <path d="M8 16H16"></path>
    </svg>
  `;
  saveBtn.setAttribute("aria-label", "Salvar edição do comentário");
  saveBtn.title = "Salvar edição do comentário";
  actions.appendChild(saveBtn);

  const cancelBtn = document.createElement("button");
  cancelBtn.type = "button";
  cancelBtn.className = "btn-light comment-edit-icon comment-edit-cancel";
  cancelBtn.innerHTML = `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 6L18 18M18 6L6 18"></path>
    </svg>
  `;
  cancelBtn.setAttribute("aria-label", "Cancelar edição do comentário");
  cancelBtn.title = "Cancelar edição do comentário";
  cancelBtn.addEventListener("click", onCancel);
  actions.appendChild(cancelBtn);

  form.appendChild(actions);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const content = normalize(textarea.value);
    const type = typeSelect.value;
    onSave({ content, type });
  });

  return form;
}

async function deleteProjectComment(comment) {
  if (!window.confirm("Deseja remover este comentário")) return;
  try {
    await request(`/projects/${state.projectId}/comments/${comment.id}`, {
      method: "DELETE"
    });
    showToast("Coment\u00e1rio removido.", "success");
    await loadProjectComments();
  } catch (error) {
    showToast(error.message, "error");
  }
}

async function loadTaskComments(taskId) {
  elements.taskCommentsList.innerHTML = "";
  const comments = await request(`/tasks/${taskId}/comments`);
  comments.forEach((comment) => {
    const li = document.createElement("li");
    li.className = "comment-item";
    li.innerHTML = `
      <strong>${comment.userName}</strong>
      <span class="comment-meta">
        <span class="comment-type comment-type-${comment.type || "anotacao"}">${commentTypeLabel(comment.type)}</span>
        <span class="hint">Em ${formatDateTime(comment.createdAt)}</span>
      </span>
    `;

    const isEditing = Number(state.editingTaskCommentId) === Number(comment.id);
    if (isEditing) {
      li.appendChild(
        createCommentEditForm(comment, {
          onSave: async ({ content, type }) => {
            if (content.length < 20) {
              return showToast("Comentário deve ter no mínimo 20 caracteres.", "error");
            }
            try {
              await request(`/tasks/${taskId}/comments/${comment.id}`, {
                method: "PATCH",
                body: JSON.stringify({ content, type })
              });
              state.editingTaskCommentId = null;
              showToast("Comentário atualizado.", "success");
              await loadTaskComments(taskId);
              await loadTasks();
            } catch (error) {
              showToast(error.message, "error");
            }
          },
          onCancel: async () => {
            state.editingTaskCommentId = null;
            await loadTaskComments(taskId);
          }
        })
      );
      elements.taskCommentsList.appendChild(li);
      return;
    }

    const contentLine = document.createElement("span");
    contentLine.textContent = comment.content;
    li.appendChild(contentLine);

    const canEdit = canEditComment(comment);
    const canDelete = canDeleteComment(comment);
    if (canEdit || canDelete) {
      li.appendChild(
        createCommentMenu({
          userName: comment.userName,
          canEdit,
          canDelete,
          onEdit: async () => editTaskComment(comment),
          onDelete: async () => deleteTaskComment(comment)
        })
      );
    }
    elements.taskCommentsList.appendChild(li);
  });
}

async function openTaskCard(taskId) {
  const task = findTaskById(taskId);
  if (!task) return;
  state.selectedTask = task;
  state.editingTaskCommentId = null;
  elements.taskModalTitle.textContent = task.title;
  elements.taskModalDescription.textContent = task.description;
  elements.taskSettingsAssignedTo.value = task.assignedTo ? String(task.assignedTo) : "";
  if (state.project.role === "admin") {
    elements.taskSettingsAssignedTo.disabled = false;
    elements.taskSettingsForm.querySelector("button[type='submit']").disabled = false;
    elements.taskSettingsHint.textContent = "Admin pode alterar o responsavel deste item.";
  } else {
    elements.taskSettingsAssignedTo.disabled = true;
    elements.taskSettingsForm.querySelector("button[type='submit']").disabled = true;
    elements.taskSettingsHint.textContent = "Somente admin pode alterar o responsavel.";
  }
  elements.taskCommentForm.reset();
  await loadTaskComments(task.id);
  openModal(elements.taskModal);
}

async function loadProjectComments() {
  elements.projectCommentsList.innerHTML = "";
  const comments = await request(`/projects/${state.projectId}/comments`);
  comments.forEach((comment) => {
    const li = document.createElement("li");
    li.className = "comment-item";
    li.innerHTML = `
      <strong>${comment.userName}</strong>
      <span class="comment-meta">
        <span class="comment-type comment-type-${comment.type || "anotacao"}">${commentTypeLabel(comment.type)}</span>
        <span class="hint">Em ${formatDateTime(comment.createdAt)}</span>
      </span>
    `;

    const isEditing = Number(state.editingProjectCommentId) === Number(comment.id);
    if (isEditing) {
      li.appendChild(
        createCommentEditForm(comment, {
          onSave: async ({ content, type }) => {
            if (content.length < 20) {
              return showToast("Comentário deve ter no mínimo 20 caracteres.", "error");
            }
            try {
              await request(`/projects/${state.projectId}/comments/${comment.id}`, {
                method: "PATCH",
                body: JSON.stringify({ content, type })
              });
              state.editingProjectCommentId = null;
              showToast("Comentário atualizado.", "success");
              await loadProjectComments();
            } catch (error) {
              showToast(error.message, "error");
            }
          },
          onCancel: async () => {
            state.editingProjectCommentId = null;
            await loadProjectComments();
          }
        })
      );
      elements.projectCommentsList.appendChild(li);
      return;
    }

    const contentLine = document.createElement("span");
    contentLine.textContent = comment.content;
    li.appendChild(contentLine);

    const canEdit = canEditComment(comment);
    const canDelete = canDeleteComment(comment);
    if (canEdit || canDelete) {
      li.appendChild(
        createCommentMenu({
          userName: comment.userName,
          canEdit,
          canDelete,
          onEdit: async () => editProjectComment(comment),
          onDelete: async () => deleteProjectComment(comment)
        })
      );
    }
    elements.projectCommentsList.appendChild(li);
  });
}

elements.backToProjects.addEventListener("click", () => {
  if (window.history.length > 1) {
    window.history.back();
  } else {
    window.location.href = "/app";
  }
});

elements.openTaskCreate.addEventListener("click", () => {
  openTaskCreateForStatus("a_fazer");
});

elements.openSettings.addEventListener("click", async () => {
  state.editingProjectCommentId = null;
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
elements.closeTaskCreateModal.addEventListener("click", () => {
  resetTaskFormMode();
  closeModal(elements.taskCreateModal);
});
elements.closeSettingsModal.addEventListener("click", () => closeModal(elements.settingsModal));
elements.closeHistoryModal.addEventListener("click", () => closeModal(elements.historyModal));
elements.closeDeleteTaskModal.addEventListener("click", resetDeleteTaskModal);
elements.cancelDeleteTask.addEventListener("click", resetDeleteTaskModal);
elements.closeDeleteMemberModal.addEventListener("click", resetDeleteMemberModal);
elements.cancelDeleteMember.addEventListener("click", resetDeleteMemberModal);
elements.closeBlockingConfirmModal.addEventListener("click", () => resetBlockingConfirmModal(false));
elements.cancelBlockingConfirm.addEventListener("click", () => resetBlockingConfirmModal(false));
elements.confirmBlockingConfirm.addEventListener("click", () => resetBlockingConfirmModal(true));
elements.closeLogoutModal.addEventListener("click", () => closeModal(elements.logoutModal));
elements.cancelLogout.addEventListener("click", () => closeModal(elements.logoutModal));
elements.confirmLogout.addEventListener("click", clearSession);

elements.taskModal.addEventListener("click", (event) => {
  if (event.target === elements.taskModal) closeModal(elements.taskModal);
});
elements.taskCreateModal.addEventListener("click", (event) => {
  if (event.target === elements.taskCreateModal) {
    resetTaskFormMode();
    closeModal(elements.taskCreateModal);
  }
});
elements.settingsModal.addEventListener("click", (event) => {
  if (event.target === elements.settingsModal) closeModal(elements.settingsModal);
});
elements.historyModal.addEventListener("click", (event) => {
  if (event.target === elements.historyModal) closeModal(elements.historyModal);
});
elements.deleteTaskModal.addEventListener("click", (event) => {
  if (event.target === elements.deleteTaskModal) resetDeleteTaskModal();
});
elements.deleteMemberModal.addEventListener("click", (event) => {
  if (event.target === elements.deleteMemberModal) resetDeleteMemberModal();
});
elements.blockingConfirmModal.addEventListener("click", (event) => {
  if (event.target === elements.blockingConfirmModal) resetBlockingConfirmModal(false);
});
elements.logoutModal.addEventListener("click", (event) => {
  if (event.target === elements.logoutModal) closeModal(elements.logoutModal);
});

elements.confirmDeleteTask.addEventListener("click", async () => {
  if (!state.taskPendingDelete) return;
  try {
    await deleteTask(state.taskPendingDelete.id);
    resetDeleteTaskModal();
  } catch (error) {
    showToast(error.message, "error");
  }
});

elements.confirmDeleteMember.addEventListener("click", async () => {
  if (!state.memberPendingDelete) return;
  try {
    await request(`/projects/${state.projectId}/members/${state.memberPendingDelete.id}`, {
      method: "DELETE"
    });
    showToast("Membro removido.", "success");
    resetDeleteMemberModal();
    await loadProject();
    await loadTasks();
  } catch (error) {
    showToast(error.message, "error");
  }
});

elements.taskForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const title = normalize(document.getElementById("task-title-input").value);
  const description = normalize(document.getElementById("task-description-input").value);
  const assignedTo = elements.taskAssignedTo.value || null;
  const status = elements.taskStatus.value;

  if (title.length < 15) return showToast("T\u00edtulo deve ter no m\u00ednimo 15 caracteres.", "error");
  if (description.length < 30) return showToast("Descrição deve ter no mínimo 30 caracteres.", "error");

  try {
    if (state.editingTaskId) {
      await request(`/tasks/${state.editingTaskId}`, {
        method: "PATCH",
        body: JSON.stringify({ title, description, assignedTo, status })
      });
    } else {
      await request("/tasks", {
        method: "POST",
        body: JSON.stringify({ projectId: state.projectId, title, description, assignedTo, status })
      });
    }
    elements.taskForm.reset();
    showToast(state.editingTaskId ? "Item atualizado." : "Item criado.", "success");
    resetTaskFormMode();
    closeModal(elements.taskCreateModal);
    await loadTasks();
  } catch (error) {
    showToast(error.message, "error");
  }
});

elements.taskSettingsForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!state.selectedTask) return showToast("Selecione um item.", "error");
  if (state.project.role !== "admin") return showToast("Apenas admin pode alterar o responsavel.", "error");

  const assignedTo = elements.taskSettingsAssignedTo.value || null;
  try {
    await request(`/tasks/${state.selectedTask.id}`, {
      method: "PATCH",
      body: JSON.stringify({ assignedTo })
    });
    showToast("Responsavel atualizado.", "success");
    await loadTasks();
    const refreshedTask = findTaskById(state.selectedTask.id);
    if (refreshedTask) {
      state.selectedTask = refreshedTask;
      elements.taskModalDescription.textContent = refreshedTask.description;
      elements.taskSettingsAssignedTo.value = refreshedTask.assignedTo
        ? String(refreshedTask.assignedTo)
        : "";
    }
  } catch (error) {
    showToast(error.message, "error");
  }
});

elements.taskCommentForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!state.selectedTask) return showToast("Selecione um item.", "error");
  const content = normalize(elements.taskCommentContent.value);
  const type = elements.taskCommentType.value;
  if (content.length < 20) return showToast("Coment\u00e1rio deve ter no m\u00ednimo 20 caracteres.", "error");

  try {
    await request(`/tasks/${state.selectedTask.id}/comments`, {
      method: "POST",
      body: JSON.stringify({ content, type })
    });
    elements.taskCommentContent.value = "";
    elements.taskCommentType.value = "anotacao";
    showToast("Coment\u00e1rio adicionado.", "success");
    await loadTaskComments(state.selectedTask.id);
    await loadTasks();
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
  if (name.length < 5) return showToast("Nome do projeto deve ter no mínimo 5 caracteres.", "error");
  if (description.length < 15) {
    return showToast("Descri\u00e7\u00e3o do projeto deve ter no mínimo 15 caracteres.", "error");
  }

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
  const type = elements.projectCommentType.value;
  if (content.length < 20) return showToast("Coment\u00e1rio deve ter no m\u00ednimo 20 caracteres.", "error");

  try {
    await request(`/projects/${state.projectId}/comments`, {
      method: "POST",
      body: JSON.stringify({ content, type })
    });
    elements.projectCommentContent.value = "";
    elements.projectCommentType.value = "anotacao";
    showToast("Comentário do projeto adicionado.", "success");
    await loadProjectComments();
  } catch (error) {
    showToast(error.message, "error");
  }
});

async function bootstrap() {
  renderSession();
  if (elements.openTaskCreate) elements.openTaskCreate.classList.add("hidden");
  setupKanbanDragAndDrop();
  try {
    await loadProject();
    await loadTasks();
    if (state.openTarget === "settings") {
      await loadProjectComments();
      openModal(elements.settingsModal);
    }
  } catch (error) {
    showToast(error.message, "error");
    if (String(error.message || "").toLowerCase().includes("token")) clearSession();
  }
}

bootstrap();





