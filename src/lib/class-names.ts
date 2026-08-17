export type ClassValue = string | number | boolean | null | undefined | Array<ClassValue> | Record<string, unknown>;

function collect(value: ClassValue, into: Array<string>): void {
  if (!value) {
    return;
  }

  if (typeof value === "string") {
    into.push(value);
  } else if (typeof value === "number") {
    into.push(String(value));
  } else if (Array.isArray(value)) {
    for (const entry of value) {
      collect(entry, into);
    }
  } else if (typeof value === "object") {
    for (const [name, enabled] of Object.entries(value)) {
      if (enabled) {
        into.push(name);
      }
    }
  }
}

/**
 * Joins class names, ignoring falsy values. Accepts strings, numbers,
 * nested arrays, and objects whose truthy keys become class names.
 */
export function cx(...values: Array<ClassValue>): string {
  const classNames: Array<string> = [];

  for (const value of values) {
    collect(value, classNames);
  }

  return classNames.join(" ");
}
