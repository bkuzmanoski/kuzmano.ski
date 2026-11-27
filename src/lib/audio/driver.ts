const DRIVER_QUANTIZATION_STEPS = 127; // Signed 8-bit full-scale amplitude.

/** Sample rate of the Macintosh 128K sound driver, in Hz. */
export const DRIVER_SAMPLE_RATE = 22254.54;

export const quantizeToDriver = (value: number) =>
  Math.round(value * DRIVER_QUANTIZATION_STEPS) / DRIVER_QUANTIZATION_STEPS;
