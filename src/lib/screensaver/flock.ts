import type { StyleWithVars } from "../style";

const FLIGHT_DURATION_S = { fast: 10, medium: 16, slow: 24 }; // How long a sprite takes to fly its whole course, in seconds.

type Speed = keyof typeof FLIGHT_DURATION_S;

const TOAST_IMAGES = ["toast-1", "toast-2", "toast-3"] as const;
const FLAP_FRAMES = 4;

// Start positions, as percentages of the viewport measured in from its top and right edges.
const START_POSITIONS = [
  // Batch 1
  [2, -17],
  [10, -19],
  [20, -18],
  [30, -20],
  [40, -21],
  [50, -18],
  [60, -20],
  [-17, 10],
  [-19, 20],
  [-21, 30],
  [-23, 50],
  [-25, 70],
  // Batch 2
  [0, -26],
  [10, -20],
  [20, -36],
  [30, -24],
  [40, -33],
  [60, -40],
  [-26, 10],
  [-36, 30],
  [-29, 50],
  // Batch 3
  [0, -46],
  [10, -56],
  [20, -49],
  [30, -60],
  [-46, 10],
  [-56, 20],
  [-49, 30],
] as const satisfies ReadonlyArray<readonly [right: number, top: number]>;

interface Wave {
  speed: Speed;
  delayS: number; // Seconds before the wave's first crossing.
  toasters?: ReadonlyArray<number>; // Indices into `START_POSITIONS`. A position may reappear in a later wave: the delay keeps them apart.
  toast?: ReadonlyArray<number>;
}

// The flock, in waves.
const WAVES: ReadonlyArray<Wave> = [
  { speed: "fast", delayS: 0, toasters: [0, 5, 11, 16, 22, 26], toast: [2, 18] },
  { speed: "medium", delayS: 0, toasters: [7, 15, 25], toast: [10, 13, 20, 24] },
  { speed: "slow", delayS: 0, toasters: [1, 3, 6], toast: [8, 14, 27] },
  { speed: "slow", delayS: 4, toasters: [9, 12, 16] },
  { speed: "fast", delayS: 5, toasters: [4, 19, 21, 23] },
  { speed: "slow", delayS: 8, toasters: [0, 5, 9, 13, 17] },
  { speed: "slow", delayS: 12, toasters: [1, 6, 10, 14, 18], toast: [4, 9, 17] },
  { speed: "slow", delayS: 16, toasters: [2, 7, 11, 19] },
  { speed: "slow", delayS: 20, toasters: [8, 12, 15, 20] },
];

export type SpriteImage = "toaster" | (typeof TOAST_IMAGES)[number];

export interface Sprite {
  image: SpriteImage;
  style: StyleWithVars;
}

const flights = WAVES.flatMap(({ speed, delayS, toasters = [], toast = [] }) => [
  ...toasters.map((start) => ({ start, speed, delayS, isToaster: true })),
  ...toast.map((start) => ({ start, speed, delayS, isToaster: false })),
]);

export const FLOCK: ReadonlyArray<Sprite> = flights.map(({ start, speed, delayS, isToaster }, index) => {
  const [right, top] = START_POSITIONS[start]!;
  return {
    image: isToaster ? "toaster" : TOAST_IMAGES[index % TOAST_IMAGES.length]!,
    style: {
      "--start-top": `${top}%`,
      "--start-right": `${right}%`,
      "--flight-duration": `${FLIGHT_DURATION_S[speed]}s`,
      "--flight-delay": `${delayS}s`,
      "--flap-phase": index % FLAP_FRAMES,
    },
  };
});
