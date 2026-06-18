import Image from "next/image";

import { cn } from "@/lib/utils";

type NovusLogoProps = {
  className?: string;
  priority?: boolean;
};

export function NovusLogo({ className, priority = false }: NovusLogoProps) {
  return (
    <Image
      src="/novus-logo.svg"
      alt="NovusMail"
      width={128}
      height={128}
      priority={priority}
      className={cn("h-auto w-auto object-contain", className)}
    />
  );
}
