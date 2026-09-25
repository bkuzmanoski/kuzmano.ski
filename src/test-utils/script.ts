/** Evaluates `script` as the body of a function created in the global scope. */
export function runScript(script: string) {
  // eslint-disable-next-line @typescript-eslint/no-implied-eval, @typescript-eslint/no-unsafe-call -- Tests the bundle as it would be evaluated in the browser.
  new Function(script)();
}
