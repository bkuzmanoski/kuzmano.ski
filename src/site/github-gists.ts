// Imports only leaf modules because `/vite.config.ts` loads this module through `/build`.
import { GITHUB_GISTS_URL } from "#/config/site.ts";

export const githubGistUrlOf = (gistId: string) => `${GITHUB_GISTS_URL}/${gistId}`;
