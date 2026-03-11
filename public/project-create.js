const apiBase = "/api";

const state = {
  token: localStorage.getItem("token") || "",
  user: JSON.parse(localStorage.getItem("user") || "null"),
  lastFocusedElement: null
};

if (!state.token) window.location.href = "/login";

const toast = document.getElementById("toast");
const sessionArea = document.getElementById("session-area");
const projectForm = document.getElementById("project-form");
const logoutModal = document.getElementById("logout-modal");
const closeLogoutModal = document.getElementById("close-logout-modal");
const cancelLogout = document.getElementById("cancel-logout");
const confirmLogout = document.getElementById("confirm-logout");

function normalize(value) {
  return String(value || "").trim();
}

let toastTimer;
function showToast(message, type = "info") {
  toast.textContent = message;
  toast.classList.remove("toast-success", "toast-error", "toast-info", "show");
  toast.classList.add(`toast-${type}`);
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2600);
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
  sessionArea.innerHTML = `
    <div class="session-user">
      <span class="session-name">${state.user.name || ""}</span>
      <span class="session-email">${state.user.email || ""}</span>
    </div>
    <button id="logout-btn" class="danger" aria-label="Encerrar sessão" title="Encerrar sessão">Sair</button>
  `;
  document.getElementById("logout-btn").addEventListener("click", () => openModal(logoutModal));
}

projectForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const name = normalize(document.getElementById("project-name").value);
  const description = normalize(document.getElementById("project-description").value);

  if (name.length < 5) return showToast("Nome do projeto deve ter no mínimo 5 caracteres.", "error");
  if (description.length < 15) return showToast("Descrição do projeto deve ter no mínimo 15 caracteres.", "error");

  try {
    const project = await request("/projects", {
      method: "POST",
      body: JSON.stringify({ name, description })
    });
    showToast("Projeto criado com sucesso.", "success");
    window.location.href = `/projectprojectId=${project.id}`;
  } catch (error) {
    showToast(error.message, "error");
  }
});

closeLogoutModal.addEventListener("click", () => closeModal(logoutModal));
cancelLogout.addEventListener("click", () => closeModal(logoutModal));
confirmLogout.addEventListener("click", clearSession);
logoutModal.addEventListener("click", (event) => {
  if (event.target === logoutModal) closeModal(logoutModal);
});

renderSession();





