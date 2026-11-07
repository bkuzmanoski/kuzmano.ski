import { CLIENT_ENVIRONMENT } from "./environments.ts";
import { requestPathOf } from "./paths.ts";

import type { IncomingMessage } from "node:http";
import type { Plugin, ViteDevServer } from "vite";

export interface ServedFile {
  contentType: string;
  contents: string | Uint8Array;
}

/**
 * Serves files emitted by the build during `vite dev`.
 *
 * `fileFor` returns `null` without generating a file when it does not handle a path. Otherwise, it returns a promise
 * that resolves to the generated file, or `null` if a generated file does not exist for the path.
 */
export function serveGeneratedFiles(
  server: ViteDevServer,
  fileFor: (requestPath: string | undefined, request: IncomingMessage) => Promise<ServedFile | null> | null,
) {
  server.middlewares.use((request, response, next) => {
    const pendingFile = fileFor(requestPathOf(request), request);

    if (!pendingFile) {
      next();
      return;
    }

    pendingFile
      .then((file) => {
        if (!file) {
          next();
          return;
        }

        response.setHeader("content-type", file.contentType);
        response.end(file.contents);
      })
      .catch(next);
  });
}

export interface GeneratedFilesPluginOptions {
  name: string;
  fileNames: ReadonlyArray<string>;
  load: (fileName: string, server: ViteDevServer | null) => Promise<ServedFile>;
}

/** Emits generated files in client builds and serves them during `vite dev`. */
export function generatedFilesPlugin({ name, fileNames, load }: GeneratedFilesPluginOptions): Plugin {
  return {
    name,
    applyToEnvironment: (environment) => environment.name === CLIENT_ENVIRONMENT,
    async generateBundle() {
      for (const fileName of fileNames) {
        this.emitFile({ type: "asset", fileName, source: (await load(fileName, null)).contents });
      }
    },
    configureServer(server) {
      serveGeneratedFiles(server, (requestPath) => {
        const fileName = fileNames.find((candidate) => requestPath === `/${candidate}`);

        // Generate files only when requested, so generation failures do not affect other requests.
        return fileName === undefined ? null : load(fileName, server);
      });
    },
  };
}
