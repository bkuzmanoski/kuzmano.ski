import { RESUME_URL } from "#/config/site";
import type { Icon, IconLayout } from "#/lib/icon";

export const ICONS: Array<Icon> = [
  { id: "about", kind: "app", label: "About", route: "/about" },
  { id: "tech-notes", kind: "folder", label: "Tech Notes", route: "/tech-notes" },
  { id: "design-notes", kind: "folder", label: "Design Notes", route: "/design-notes" },
  { id: "work", kind: "folder", label: "Work", route: "/work" },
  { id: "contact", kind: "app", label: "Contact", route: "/contact" },
  { id: "resume", kind: "document", label: "Résumé.pdf", downloadUrl: RESUME_URL },
];

export const ICON_IDS = ICONS.map((iconDefinition) => iconDefinition.id);

export const ICON_LAYOUT: IconLayout = {
  cellSize: 76,
  position: { top: 24, right: 28 },
  spacing: 84,
};

export const STORAGE_KEY = "icon-positions";
