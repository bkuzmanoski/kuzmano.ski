import type { FileRouteTypes } from "#/routeTree.gen.ts";

/** The path every API route starts with. */
export const API_PATH_PREFIX = "/api/";

type ApiRoute = Extract<FileRouteTypes["fullPaths"], `${typeof API_PATH_PREFIX}${string}`>;

export const API_ROUTES = {
  clientErrors: "/api/client-errors",
  contact: "/api/contact",
  githubContributions: "/api/github-contributions",
  waitlist: "/api/waitlist",
} as const satisfies Record<string, ApiRoute>;

type Assert<TCondition extends true> = TCondition;
type UnlistedRoute = Exclude<ApiRoute, (typeof API_ROUTES)[keyof typeof API_ROUTES]>;

// Fails to compile, naming the route, when a file in `/src/routes/api` has no entry in `API_ROUTES`.
export type EveryApiRouteIsListed = Assert<[UnlistedRoute] extends [never] ? true : UnlistedRoute>;
