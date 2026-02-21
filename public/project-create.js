const apiBase = "/api";

const state = {
  token: localStorage.getItem("token") || "",
  user: JSON.parse(localStorage.getItem("user") || "null")
};

if (!state.token) window.location.href = "/login";

const toast = document.getElementById("toast");
const sessionArea = document.getElementById("session-area");
const projectForm = document.getElementById("project-form");

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
      <span class="session-name">${state.user?.name || ""}</span>
      <span class="session-email">${state.user?.email || ""}</span>
    </div>
    <button id="logout-btn" class="danger">Sair</button>
  `;
  document.getElementById("logout-btn").addEventListener("click", clearSession);
}

projectForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const name = normalize(document.getElementById("project-name").value);
  const description = normalize(document.getElementById("project-description").value);

  if (!name) return showToast("Nome do projeto é obrigatório.", "error");
  if (description.length < 30) return showToast("Descrição do projeto deve ter no mínimo 30 caracteres.", "error");

  try {
    const project = await request("/projects", {
      method: "POST",
      body: JSON.stringify({ name, description })
    });
    showToast("Projeto criado com sucesso.", "success");
    window.location.href = `/project?projectId=${project.id}`;
  } catch (error) {
    showToast(error.message, "error");
  }
});

renderSession();
