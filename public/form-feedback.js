function setupMinLengthFeedback() {
  const fields = document.querySelectorAll("input[minlength], textarea[minlength]");

  fields.forEach((field) => {
    const minLength = Number(field.getAttribute("minlength"));
    if (!minLength || Number.isNaN(minLength)) return;

    let feedback = field.parentElement.querySelector(`[data-feedback-for="${field.id}"]`);
    if (!feedback) {
      feedback = document.createElement("p");
      feedback.className = "field-alert";
      feedback.dataset.feedbackFor = field.id;
      field.insertAdjacentElement("afterend", feedback);
    }

    const updateFeedback = () => {
      const current = String(field.value || "").trim().length;
      const remaining = Math.max(0, minLength - current);

      feedback.classList.remove("is-ok", "is-error");

      if (current === 0) {
        feedback.textContent = `Mínimo de ${minLength} caracteres.`;
        return;
      }

      if (remaining > 0) {
        feedback.textContent = `Faltam ${remaining} caracteres para atingir o mínimo.`;
        feedback.classList.add("is-error");
      } else {
        feedback.textContent = "Mínimo atingido.";
        feedback.classList.add("is-ok");
      }
    };

    field.addEventListener("input", updateFeedback);
    field.addEventListener("blur", updateFeedback);
    updateFeedback();
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", setupMinLengthFeedback);
} else {
  setupMinLengthFeedback();
}
