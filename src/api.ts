import type { FileRouteTypes } from "#/routeTree.gen.ts";

type ApiRoute = Extract<FileRouteTypes["fullPaths"], `/api/${string}`>;

export const API = {
  clientErrors: "/api/client-errors",
  contact: "/api/contact",
  waitlist: "/api/waitlist",
} as const satisfies Record<string, ApiRoute>;

type Assert<TCondition extends true> = TCondition;
type UnlistedRoute = Exclude<ApiRoute, (typeof API)[keyof typeof API]>;

// Fails to compile, naming the route, when a file in `/src/routes/api` has no entry in `API`.
export type EveryApiRouteIsListed = Assert<[UnlistedRoute] extends [never] ? true : UnlistedRoute>;
