import type { Rect } from "./geometry";

/* Metrics derived from the illustration, in its own coordinates. */
const CASE = { width: 1214, height: 1067 };
const DISK_LIGHT = { x: 890, y: 670, size: 6 };

export const VIEWABLE_AREA = { x: 330, y: 99, width: 554, height: 410 };

/* Metrics scaled to the displayed size of the illustration. */
const VIEWABLE_AREA_FRACTION = {
  x: VIEWABLE_AREA.x / CASE.width,
  y: VIEWABLE_AREA.y / CASE.height,
  width: VIEWABLE_AREA.width / CASE.width,
  height: VIEWABLE_AREA.height / CASE.height,
};

export const DISK_LIGHT_FRACTION = {
  x: DISK_LIGHT.x / CASE.width,
  y: DISK_LIGHT.y / CASE.height,
  size: DISK_LIGHT.size / CASE.width,
};

/** The display cutout of an illustration drawn at `box`, in the same coordinates. */
export function viewableAreaOf(box: Rect): Rect {
  return {
    x: box.x + box.width * VIEWABLE_AREA_FRACTION.x,
    y: box.y + box.height * VIEWABLE_AREA_FRACTION.y,
    width: box.width * VIEWABLE_AREA_FRACTION.width,
    height: box.height * VIEWABLE_AREA_FRACTION.height,
  };
}
