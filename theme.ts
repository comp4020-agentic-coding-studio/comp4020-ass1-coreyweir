// Dark is the default regardless of system preference — a deliberate choice
// (see CLAUDE.md), not an oversight. `data-theme="light"` on <html> is the
// only opt-out, flipped by the toggle button and remembered in localStorage.

const STORAGE_KEY = "theme";

function applyStoredTheme(): void {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "light") {
    document.documentElement.dataset.theme = "light";
  }
}

function updateToggleLabel(toggle: HTMLButtonElement): void {
  const isLight = document.documentElement.dataset.theme === "light";
  const label = toggle.querySelector<HTMLElement>(".theme-toggle-label");
  if (label) label.textContent = isLight ? "Switch to dark mode" : "Switch to light mode";
  toggle.setAttribute("aria-pressed", String(isLight));
  toggle.title = isLight ? "Switch to dark mode" : "Switch to light mode";
}

export function initTheme(toggle: HTMLButtonElement | null): void {
  applyStoredTheme();
  if (!toggle) return;

  updateToggleLabel(toggle);
  toggle.addEventListener("click", () => {
    const isLight = document.documentElement.dataset.theme === "light";
    if (isLight) {
      delete document.documentElement.dataset.theme;
      localStorage.setItem(STORAGE_KEY, "dark");
    } else {
      document.documentElement.dataset.theme = "light";
      localStorage.setItem(STORAGE_KEY, "light");
    }
    updateToggleLabel(toggle);
  });
}
