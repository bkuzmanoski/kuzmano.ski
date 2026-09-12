// `parseArgs` reads every option value as a string, so a numeric option is checked here.

/** Reads an option's value as a whole number from 0 to `maximum`, or returns `undefined` when the option is absent. */
export function wholeNumberOption(name: string, value: string | undefined, maximum = Infinity): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  const parsed = Number(value);

  if (value.trim() === "" || !Number.isInteger(parsed) || parsed < 0 || parsed > maximum) {
    throw new Error(`--${name} accepts a whole number between 0 and ${maximum}.`);
  }

  return parsed;
}
