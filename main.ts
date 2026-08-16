// Self-hosted (not a CDN <link>) so the page doesn't depend on a third-party
// font request to render its own text — see CLAUDE.md on why a dependency
// was added here. Space Grotesk for headings/titles (a technical but
// distinctive display face), JetBrains Mono for the JSON payloads (built for
// code, ties the "request" boxes to a terminal/editor feel).
import "@fontsource/space-grotesk/latin-500.css";
import "@fontsource/space-grotesk/latin-600.css";
import "@fontsource/space-grotesk/latin-700.css";
import "@fontsource/jetbrains-mono/latin-400.css";
import "@fontsource/jetbrains-mono/latin-500.css";

import { mountCarousel } from "./carousel";
import { initTheme } from "./theme";

initTheme(document.querySelector<HTMLButtonElement>("#theme-toggle"));

const root = document.querySelector<HTMLElement>(".carousel");
if (root) mountCarousel(root);
