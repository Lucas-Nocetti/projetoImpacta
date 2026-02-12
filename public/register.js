const apiBase = "/api";
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_REGEX = /^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/;

const token = localStorage.getItem("token");
if (token) window.location.href = "/app";

const registerForm = document.getElementById("register-form");
const toast = document.getElementById("toast");

function normalize(value) {
  return String(value || "").trim();
}

function isFullName(name) {
  return name.length >= 15 && /\S+\s+\S+/.test(name);
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

registerForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const name = normalize(document.getElementById("register-name").value);
  const email = normalize(document.getElementById("register-email").value).toLowerCase();
  const password = String(document.getElementById("register-password").value || "");

  if (!isFullName(name)) {
    showToast("Informe nome completo com no mínimo 15 caracteres.", "error");
    return;
  }
  if (!EMAIL_REGEX.test(email)) {
    showToast("Informe um e-mail válido no formato texto@texto.com.", "error");
    return;
  }
  if (!PASSWORD_REGEX.test(password)) {
    showToast("Senha inválida: use 1 maiúscula, 1 número e 1 caractere especial.", "error");
    return;
  }

  try {
    const result = await request("/auth/register", {
      method: "POST",
      body: JSON.stringify({ name, email, password })
    });
    saveSession(result.user, result.token);
    showToast("Cadastro realizado com sucesso.", "success");
    window.location.href = "/app";
  } catch (error) {
    showToast(error.message, "error");
  }
});
