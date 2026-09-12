/**
 * Layout lengths from `/src/styles.css` `--layout-*` custom properties.
 *
 * Use `metricIn` from `/src/lib/layout-metrics.ts` to read them.
 */
declare module "virtual:layout-metrics" {
  // eslint-disable-next-line @typescript-eslint/consistent-type-imports -- A top-level import would make this an invalid module augmentation.
  export const LAYOUT_METRICS: import("./lib/layout-metrics.ts").LayoutMetrics;
}
