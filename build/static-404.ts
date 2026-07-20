import type { Plugin } from "vite";

const TITLE = "Not found—kuzmano.ski";
const SCRIPT = `(function () {
  if (!document.referrer) {
    return;
  }

  try {
    if (new URL(document.referrer).origin !== location.origin) {
      return;
    }
  } catch (e) {
    return;
  }

  var home = document.getElementById("home");
  home.hidden = true;

  var back = document.getElementById("back");
  back.hidden = false;
  back.addEventListener("click", function () {
    history.back();
  });
})();`;

const body = `<main>
  <h1>Page not found</h1>
  <p>That page doesn&rsquo;t exist.</p>
  <p>
    <a href="/" id="home">Go home</a>
    <button hidden id="back" type="button">Go back</button>
  </p>
</main>`;

/**
 * Emits a standalone 404.html for Cloudflare's `not_found_handling`.
 * (Deliberately not part of the React app.)
 *
 * The app's compiled CSS is inlined rather than linked so the page has no
 * dependency on hashed asset filenames and doesn't incur an extra request.
 */
export function static404(): Plugin {
  return {
    name: "kuzmano-ski/static-404",
    apply: "build",

    generateBundle(_options, bundle) {
      if (this.environment.name !== "client") {
        return;
      }

      const css = Object.values(bundle).filter((chunk) => chunk.type === "asset" && chunk.fileName.endsWith(".css"));

      if (css.length === 0) {
        this.error("[static-404] no CSS asset found in the client bundle");
      }

      const styles = css.map((asset) => String(asset.type === "asset" && asset.source)).join("\n");

      this.emitFile({
        type: "asset",
        fileName: "404.html",
        source: `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta content="width=device-width, initial-scale=1" name="viewport" />
    <title>${TITLE}</title>
    <style>
${styles}
    </style>
  </head>
  <body>
${body}
    <script>
${SCRIPT}
    </script>
  </body>
</html>
`,
      });
    },
  };
}
