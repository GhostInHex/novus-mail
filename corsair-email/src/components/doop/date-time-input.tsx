"use client";

import { format } from "date-fns";
import type { ComponentProps } from "react";
import { Input } from "@/components/ui/input";

type Props = Omit<ComponentProps<typeof Input>, "type" | "value"> & { value: string };

export function DoopDateTimeInput({ value, className, ...props }: Props) {
  const date = new Date(value);
  const display = value && !Number.isNaN(date.getTime())
    ? format(date, "MMM d, yyyy '·' h:mm a")
    : "Choose date and time";
  return <div className="doop-date-time-field">
    <span aria-hidden="true">{display}</span>
    <Input {...props} className={className} type="datetime-local" value={value} />
  </div>;
}
