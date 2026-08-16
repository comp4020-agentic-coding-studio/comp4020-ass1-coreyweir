import { mountCarousel } from "./carousel";
import { initTheme } from "./theme";

initTheme(document.querySelector<HTMLButtonElement>("#theme-toggle"));

const root = document.querySelector<HTMLElement>(".carousel");
if (root) mountCarousel(root);
