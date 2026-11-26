import { formattedDatePropsOf } from "./formatted-date-props.ts";

import type { ComponentProps } from "react";

/** Renders `date` formatted by `format` in a `<time>` (see `formattedDatePropsOf`). */
export function FormattedDate({
  date,
  format,
  ...timeProps
}: { date: string; format: Intl.DateTimeFormat } & Omit<ComponentProps<"time">, "dateTime" | "lang" | "children">) {
  return <time dateTime={date} {...formattedDatePropsOf(date, format)} {...timeProps} />;
}
