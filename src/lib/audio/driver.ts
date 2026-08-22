const DRIVER_QUANTIZATION_STEPS = 127; // Eight bits, signed, across the full swing of the cone.

/** The sample rate used by the Macintosh 128K sound driver, in Hz. */
export const DRIVER_SAMPLE_RATE = 22254.54;

export const quantizeToDriver = (value: number) =>
  Math.round(value * DRIVER_QUANTIZATION_STEPS) / DRIVER_QUANTIZATION_STEPS;
