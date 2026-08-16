// Self-hosted (not a CDN <link>) so the page doesn't depend on a third-party
// font request to render its own text — see CLAUDE.md on why a dependency
// was added here. JetBrains Mono for the JSON payloads (built for code,
// ties the "request" boxes to a terminal/editor feel). Fraunces for all the
// heading-ish text (title, step heading, peeks) — one "typeset" family
// throughout, replacing the earlier Space Grotesk/Fraunces split (see
// CLAUDE.md): italic for emphasis, regular weights for everything else.
import "@fontsource/jetbrains-mono/latin-400.css";
import "@fontsource/jetbrains-mono/latin-500.css";
import "@fontsource/fraunces/latin-500.css";
import "@fontsource/fraunces/latin-600.css";
import "@fontsource/fraunces/latin-700.css";
import "@fontsource/fraunces/latin-600-italic.css";

import { mountCarousel } from "./carousel";
import { initTheme } from "./theme";

initTheme(document.querySelector<HTMLButtonElement>("#theme-toggle"));

const root = document.querySelector<HTMLElement>(".carousel");
if (root) mountCarousel(root);
