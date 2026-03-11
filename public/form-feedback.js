function ensureFeedbackElement(field) {
  let feedback = field.parentElement.querySelector(`[data-feedback-for="${field.id}"]`);
  if (!feedback) {
    feedback = document.createElement("p");
    feedback.className = "field-alert hidden";
    feedback.dataset.feedbackFor = field.id;
    feedback.id = `${field.id}-feedback`;
    feedback.setAttribute("role", "status");
    feedback.setAttribute("aria-live", "polite");
    field.insertAdjacentElement("afterend", feedback);
  }
  return feedback;
}

function showFeedback(field, feedback, message) {
  feedback.textContent = message;
  feedback.classList.remove("hidden");
  feedback.classList.add("is-error");
  field.setAttribute("aria-invalid", "true");
  field.setAttribute("aria-describedby", feedback.id);
}

function hideFeedback(field, feedback) {
  feedback.textContent = "";
  feedback.classList.add("hidden");
  feedback.classList.remove("is-error", "is-ok");
  field.removeAttribute("aria-invalid");
  field.removeAttribute("aria-describedby");
}

function setupMinLengthFeedback() {
  const fields = document.querySelectorAll("input[minlength], textarea[minlength]");

  fields.forEach((field) => {
    const minLength = Number(field.getAttribute("minlength"));
    if (!minLength || Number.isNaN(minLength)) return;

    const feedback = ensureFeedbackElement(field);

    const updateFeedback = () => {
      const current = String(field.value || "").trim().length;
      const remaining = Math.max(0, minLength - current);

      if (current === 0) {
        hideFeedback(field, feedback);
        return;
      }

      if (remaining > 0) {
        showFeedback(field, feedback, `* Faltam ${remaining} caracteres para atingir o mínimo.`);
        return;
      }

      hideFeedback(field, feedback);
    };

    field.addEventListener("input", updateFeedback);
    field.addEventListener("blur", updateFeedback);
    updateFeedback();
  });
}

function setupPatternAndEmailFeedback() {
  const fields = document.querySelectorAll("input[type='email'], input[pattern]");

  fields.forEach((field) => {
    const feedback = ensureFeedbackElement(field);
    const customMessage =
      field.dataset.invalidMessage ||
      (field.type === "email"
        ? "* Informe um e-mail válido no formato texto@texto.com."
        : "* Formato inválido.");

    const updateFeedback = () => {
      const value = String(field.value || "").trim();
      if (!value) {
        hideFeedback(field, feedback);
        return;
      }

      if (!field.checkValidity()) {
        showFeedback(field, feedback, customMessage);
        return;
      }

      hideFeedback(field, feedback);
    };

    field.addEventListener("input", updateFeedback);
    field.addEventListener("blur", updateFeedback);
    updateFeedback();
  });
}

function setupFormFeedback() {
  setupMinLengthFeedback();
  setupPatternAndEmailFeedback();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", setupFormFeedback);
} else {
  setupFormFeedback();
}
