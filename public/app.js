const apiBase = "/api";

const state = {
  token: localStorage.getItem("token") || "",
  user: JSON.parse(localStorage.getItem("user") || "null"),
  projects: [],
  projectPendingDelete: null,
  selectedProject: null,
  memberPendingDelete: null,
  lastFocusedElement: null
};

if (!state.token) window.location.href = "/login";

const elements = {
  sessionArea: document.getElementById("session-area"),
  projectsGrid: document.getElementById("projects-grid"),
  goCreateProject: document.getElementById("go-create-project"),
  toast: document.getElementById("toast"),
  projectSettingsModal: document.getElementById("project-settings-modal"),
  closeProjectSettingsModal: document.getElementById("close-project-settings-modal"),
  projectSettingsTitle: document.getElementById("project-settings-title"),
  projectSettingsFormApp: document.getElementById("project-settings-form-app"),
  projectSettingsNameApp: document.getElementById("project-settings-name-app"),
  projectSettingsDescriptionApp: document.getElementById("project-settings-description-app"),
  projectMemberFormApp: document.getElementById("project-member-form-app"),
  projectMemberEmailApp: document.getElementById("project-member-email-app"),
  projectMemberRoleApp: document.getElementById("project-member-role-app"),
  projectMembersListApp: document.getElementById("project-members-list-app"),
  deleteProjectModal: document.getElementById("delete-project-modal"),
  closeDeleteProjectModal: document.getElementById("close-delete-project-modal"),
  cancelDeleteProject: document.getElementById("cancel-delete-project"),
  confirmDeleteProject: document.getElementById("confirm-delete-project"),
  deleteProjectMessage: document.getElementById("delete-project-message"),
  deleteMemberModal: document.getElementById("delete-member-modal"),
  closeDeleteMemberModal: document.getElementById("close-delete-member-modal"),
  cancelDeleteMember: document.getElementById("cancel-delete-member"),
  confirmDeleteMember: document.getElementById("confirm-delete-member"),
  deleteMemberMessage: document.getElementById("delete-member-message"),
  logoutModal: document.getElementById("logout-modal"),
  closeLogoutModal: document.getElementById("close-logout-modal"),
  cancelLogout: document.getElementById("cancel-logout"),
  confirmLogout: document.getElementById("confirm-logout")
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
    <button id="logout-btn" class="danger" aria-label="Encerrar sessão" title="Encerrar sessão">Sair</button>
  `;
  document.getElementById("logout-btn").addEventListener("click", () => openModal(elements.logoutModal));
}

function roleLabel(role) {
  return role === "admin" ? "Admin" : "Usuário";
}

function roleBadgeClass(role) {
  return role === "admin" ? "badge badge-admin" : "badge badge-member";
}

function setProjectSettingsEditable(isAdmin) {
  elements.projectSettingsNameApp.disabled = !isAdmin;
  elements.projectSettingsDescriptionApp.disabled = !isAdmin;
  elements.projectSettingsFormApp.querySelector("button[type='submit']").disabled = !isAdmin;
  elements.projectMemberEmailApp.disabled = !isAdmin;
  elements.projectMemberRoleApp.disabled = !isAdmin;
  elements.projectMemberFormApp.querySelector("button[type='submit']").disabled = !isAdmin;
}

function renderProjectMembersInModal(project) {
  elements.projectMembersListApp.innerHTML = "";
  const isAdmin = project.role === "admin";
  (project.members || []).forEach((member) => {
    const li = document.createElement("li");
    li.innerHTML = `
      <strong>${member.name}</strong>
      <span>${member.email}</span>
      <span class="${roleBadgeClass(member.role)}">${roleLabel(member.role)}</span>
    `;

    if (isAdmin && member.id !== state.user?.id) {
      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "danger";
      removeBtn.textContent = "Remover";
      removeBtn.title = `Remover membro ${member.name}`;
      removeBtn.setAttribute("aria-label", `Remover membro ${member.name}`);
      removeBtn.addEventListener("click", () => {
        state.memberPendingDelete = {
          projectId: project.id,
          memberId: member.id,
          memberName: member.name
        };
        elements.deleteMemberMessage.textContent = `Tem certeza que deseja remover "${member.name}" deste projeto`;
        openModal(elements.deleteMemberModal);
      });
      li.appendChild(removeBtn);
    }

    elements.projectMembersListApp.appendChild(li);
  });
}

async function openProjectSettings(projectId) {
  const details = await request(`/projects/${projectId}`);
  state.selectedProject = details;
  elements.projectSettingsTitle.textContent = `Configurações: ${details.name}`;
  elements.projectSettingsNameApp.value = details.name || "";
  elements.projectSettingsDescriptionApp.value = details.description || "";
  setProjectSettingsEditable(details.role === "admin");
  renderProjectMembersInModal(details);
  openModal(elements.projectSettingsModal);
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

    const card = document.createElement("article");
    card.className = "project-card-shell";

    const main = document.createElement("a");
    main.className = "project-card-main";
    main.href = `/project?projectId=${projectId}`;
    main.innerHTML = `
      <strong>${project.name}</strong>
      <span>${project.description}</span>
      <span class="${roleBadgeClass(project.role)}">${roleLabel(project.role)}</span>
      <span class="hint">${project.taskCount || 0} itens vinculados</span>
    `;
    main.addEventListener("click", (event) => {
      event.preventDefault();
      window.location.assign(`/project?projectId=${projectId}`);
    });

    const menu = document.createElement("details");
    menu.className = "project-menu";
    const menuTrigger = document.createElement("summary");
    menuTrigger.className = "btn-icon project-menu-trigger";
    menuTrigger.setAttribute("aria-label", `Ações do projeto ${project.name}`);
    menuTrigger.title = `Ações do projeto ${project.name}`;
    menuTrigger.innerHTML = `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 4.8A1.5 1.5 0 1 0 12 7.8A1.5 1.5 0 0 0 12 4.8Z"></path>
        <path d="M12 10.5A1.5 1.5 0 1 0 12 13.5A1.5 1.5 0 0 0 12 10.5Z"></path>
        <path d="M12 16.2A1.5 1.5 0 1 0 12 19.2A1.5 1.5 0 0 0 12 16.2Z"></path>
      </svg>
    `;
    menu.appendChild(menuTrigger);

    const panel = document.createElement("div");
    panel.className = "project-menu-panel";

    const settingsBtn = document.createElement("button");
    settingsBtn.type = "button";
    settingsBtn.className = "project-menu-item";
    settingsBtn.title = `Abrir configurações de ${project.name}`;
    settingsBtn.innerHTML = `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 15.5A3.5 3.5 0 1 0 12 8.5A3.5 3.5 0 0 0 12 15.5Z"></path>
        <path d="M19.4 15A1.7 1.7 0 0 0 19.74 16.87L19.8 16.93A2 2 0 1 1 16.97 19.76L16.91 19.7A1.7 1.7 0 0 0 15.04 19.36A1.7 1.7 0 0 0 14 20.9V21A2 2 0 1 1 10 21V20.9A1.7 1.7 0 0 0 8.97 19.36A1.7 1.7 0 0 0 7.1 19.7L7.03 19.76A2 2 0 1 1 4.2 16.93L4.26 16.87A1.7 1.7 0 0 0 4.6 15A1.7 1.7 0 0 0 3.06 14H3A2 2 0 1 1 3 10H3.1A1.7 1.7 0 0 0 4.6 9A1.7 1.7 0 0 0 4.26 7.13L4.2 7.07A2 2 0 1 1 7.03 4.24L7.1 4.3A1.7 1.7 0 0 0 8.97 4.64H9A1.7 1.7 0 0 0 10 3.1V3A2 2 0 1 1 14 3V3.1A1.7 1.7 0 0 0 15.04 4.64A1.7 1.7 0 0 0 16.91 4.3L16.97 4.24A2 2 0 1 1 19.8 7.07L19.74 7.13A1.7 1.7 0 0 0 19.4 9V9A1.7 1.7 0 0 0 20.94 10H21A2 2 0 1 1 21 14H20.9A1.7 1.7 0 0 0 19.4 15Z"></path>
      </svg>
      <span>Configurações</span>
    `;
    settingsBtn.addEventListener("click", () => {
      menu.open = false;
      openProjectSettings(projectId).catch((error) => showToast(error.message, "error"));
    });
    panel.appendChild(settingsBtn);

    if (project.role === "admin") {
      const deleteBtn = document.createElement("button");
      deleteBtn.type = "button";
      deleteBtn.className = "project-menu-item is-danger";
      deleteBtn.title = `Excluir projeto ${project.name}`;
      deleteBtn.innerHTML = `
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 7H20"></path>
          <path d="M9 7V5H15V7"></path>
          <path d="M8 7L9 19H15L16 7"></path>
        </svg>
        <span>Excluir</span>
      `;
      deleteBtn.addEventListener("click", () => {
        menu.open = false;
        state.projectPendingDelete = { id: projectId, name: project.name };
        elements.deleteProjectMessage.textContent = `Tem certeza que deseja excluir o projeto "${project.name}"? Essa ação não pode ser desfeita.`;
        openModal(elements.deleteProjectModal);
      });
      panel.appendChild(deleteBtn);
    }

    menu.appendChild(panel);
    card.appendChild(main);
    card.appendChild(menu);
    elements.projectsGrid.appendChild(card);
  });
}

async function loadProjects() {
  state.projects = await request("/projects");
  renderProjects();
}

if (elements.goCreateProject) elements.goCreateProject.href = "/project-create";

elements.closeProjectSettingsModal.addEventListener("click", () => closeModal(elements.projectSettingsModal));
elements.projectSettingsModal.addEventListener("click", (event) => {
  if (event.target === elements.projectSettingsModal) closeModal(elements.projectSettingsModal);
});

elements.projectSettingsFormApp.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!state.selectedProject) return;
  const name = String(elements.projectSettingsNameApp.value || "").trim();
  const description = String(elements.projectSettingsDescriptionApp.value || "").trim();
  if (name.length < 5) return showToast("Nome do projeto deve ter no mínimo 5 caracteres.", "error");
  if (description.length < 15) {
    return showToast("Descrição do projeto deve ter no mínimo 15 caracteres.", "error");
  }
  try {
    await request(`/projects/${state.selectedProject.id}`, {
      method: "PATCH",
      body: JSON.stringify({ name, description })
    });
    showToast("Configurações atualizadas.", "success");
    await openProjectSettings(state.selectedProject.id);
    await loadProjects();
  } catch (error) {
    showToast(error.message, "error");
  }
});

elements.projectMemberFormApp.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!state.selectedProject) return;
  const email = String(elements.projectMemberEmailApp.value || "").trim().toLowerCase();
  const role = elements.projectMemberRoleApp.value;
  if (!email) return showToast("E-mail é obrigatório.", "error");
  try {
    await request(`/projects/${state.selectedProject.id}/members`, {
      method: "POST",
      body: JSON.stringify({ email, role })
    });
    elements.projectMemberFormApp.reset();
    showToast("Membro atualizado.", "success");
    await openProjectSettings(state.selectedProject.id);
  } catch (error) {
    showToast(error.message, "error");
  }
});

elements.closeDeleteProjectModal.addEventListener("click", () => closeModal(elements.deleteProjectModal));
elements.cancelDeleteProject.addEventListener("click", () => closeModal(elements.deleteProjectModal));
elements.deleteProjectModal.addEventListener("click", (event) => {
  if (event.target === elements.deleteProjectModal) closeModal(elements.deleteProjectModal);
});

function resetDeleteMemberState() {
  state.memberPendingDelete = null;
  closeModal(elements.deleteMemberModal);
}

elements.closeDeleteMemberModal.addEventListener("click", resetDeleteMemberState);
elements.cancelDeleteMember.addEventListener("click", resetDeleteMemberState);
elements.deleteMemberModal.addEventListener("click", (event) => {
  if (event.target === elements.deleteMemberModal) resetDeleteMemberState();
});
elements.closeLogoutModal.addEventListener("click", () => closeModal(elements.logoutModal));
elements.cancelLogout.addEventListener("click", () => closeModal(elements.logoutModal));
elements.confirmLogout.addEventListener("click", clearSession);
elements.logoutModal.addEventListener("click", (event) => {
  if (event.target === elements.logoutModal) closeModal(elements.logoutModal);
});

elements.confirmDeleteMember.addEventListener("click", async () => {
  if (!state.memberPendingDelete) return;
  try {
    await request(
      `/projects/${state.memberPendingDelete.projectId}/members/${state.memberPendingDelete.memberId}`,
      { method: "DELETE" }
    );
    showToast("Membro removido com sucesso.", "success");
    const projectId = state.memberPendingDelete.projectId;
    resetDeleteMemberState();
    await openProjectSettings(projectId);
    await loadProjects();
  } catch (error) {
    showToast(error.message, "error");
  }
});

elements.confirmDeleteProject.addEventListener("click", async () => {
  if (!state.projectPendingDelete) return;
  try {
    await request(`/projects/${state.projectPendingDelete.id}`, { method: "DELETE" });
    showToast("Projeto excluído com sucesso.", "success");
    closeModal(elements.deleteProjectModal);
    state.projectPendingDelete = null;
    await loadProjects();
  } catch (error) {
    showToast(error.message, "error");
  }
});

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




