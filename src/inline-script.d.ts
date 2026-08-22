/* The specifier that `build/inline-scripts.ts` resolves. */
declare module "*?inline-script" {
  const script: string; // The bundled and minified source of the entry.
  export default script;
}
