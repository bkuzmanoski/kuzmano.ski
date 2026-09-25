import type { Connect, Plugin, ViteDevServer } from "vite";

/**
 * Calls a plugin's `configureServer` hook with a fake dev server made from `server`, and returns the
 * middleware the hook registers.
 *
 * Throws, naming the plugin, when the hook does not register a middleware.
 */
export function devServerMiddlewareOf(plugin: Plugin, server: object = {}): Connect.NextHandleFunction {
  const { configureServer } = plugin;
  const handler = typeof configureServer === "object" ? configureServer.handler : configureServer;

  let middleware: Connect.NextHandleFunction | undefined;

  void handler?.call(
    {} as never,
    {
      ...server,
      middlewares: {
        use: (registeredMiddleware: Connect.NextHandleFunction) => void (middleware = registeredMiddleware),
      },
    } as unknown as ViteDevServer,
  );

  if (!middleware) {
    throw new Error(`\`${plugin.name}\` did not register a dev server middleware.`);
  }

  return middleware;
}

export interface DevServerExchange {
  requestHeaders: Record<string, string>;
  responseHeaders: Record<string, string>;
  body: unknown;
  isPassedOn: boolean;
}

export interface DevServerRequest {
  requestHeaders?: Record<string, string>;
  responseHeaders?: Record<string, string>;
}

/**
 * Sends a request for `url` to a dev server middleware, and resolves once the middleware ends
 * the response or passes the request on. Rejects with the error the middleware passes on.
 */
export async function devServerRequestFor(
  middleware: Connect.NextHandleFunction,
  url: string,
  { requestHeaders = {}, responseHeaders = {} }: DevServerRequest = {},
): Promise<DevServerExchange> {
  const exchange: DevServerExchange = {
    requestHeaders: { ...requestHeaders },
    responseHeaders: { ...responseHeaders },
    body: undefined,
    isPassedOn: false,
  };

  await new Promise<void>((resolve, reject) => {
    const response = {
      setHeader: (name: string, value: string) => void (exchange.responseHeaders[name.toLowerCase()] = value),
      appendHeader: (name: string, value: string) => {
        const existingValue = exchange.responseHeaders[name.toLowerCase()];
        exchange.responseHeaders[name.toLowerCase()] =
          existingValue === undefined ? value : `${existingValue}, ${value}`;
      },
      end: (body: unknown) => {
        exchange.body = body;
        resolve();
      },
    };
    const next = (cause?: unknown) => {
      if (cause) {
        reject(cause instanceof Error ? cause : new Error("The middleware passed on a failure."));
        return;
      }

      exchange.isPassedOn = true;
      resolve();
    };

    void middleware({ url, headers: exchange.requestHeaders } as never, response as never, next);
  });

  return exchange;
}
