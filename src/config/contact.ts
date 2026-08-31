// `./site.ts` keeps its extension: `build/prerender/routes.ts` imports this module, which puts it
// in the graph `vite.config.ts` loads, where an extensionless relative import does not resolve.
import { SITE_NAME } from "./site.ts";

export const CONTACT_PAGE_ROUTE = "/contact";
export const CONTACT_PAGE_TITLE = "Contact";
export const CONTACT_PAGE_DESCRIPTION = "";
export const CONTACT_DISPLAY_NAME = SITE_NAME; // Shown in the compose window's `To:` field until the address loads.
