import { mountCarousel } from "./carousel";

const root = document.querySelector<HTMLElement>("#carousel-root");
if (root) mountCarousel(root);
