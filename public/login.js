const apiBase = "/api";
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const token = localStorage.getItem("token");
if (token) window.location.href = "/app";

const loginForm = document.getElementById("login-form");
const toast = document.getElementById("toast");

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

async function request(path, options = {}) {
  const headers = options.headers || {};
  headers["Content-Type"] = "application/json";

  const response = await fetch(`${apiBase}${path}`, { ...options, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "Erro na requisição");
  return data;
}

function saveSession(user, sessionToken) {
  localStorage.setItem("token", sessionToken);
  localStorage.setItem("user", JSON.stringify(user));
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const email = normalize(document.getElementById("login-email").value).toLowerCase();
  const password = String(document.getElementById("login-password").value || "");

  if (!EMAIL_REGEX.test(email)) {
    showToast("Informe um e-mail válido.", "error");
    return;
  }

  try {
    const result = await request("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password })
    });
    saveSession(result.user, result.token);
    showToast("Login realizado com sucesso.", "success");
    window.location.href = "/app";
  } catch (error) {
    showToast(error.message, "error");
  }
});
