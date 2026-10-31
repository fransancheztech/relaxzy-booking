import type { ReactNode } from "react";
import GuidelinesShell from "./GuidelinesShell";

export default function GuidelinesLayout({ children }: { children: ReactNode }) {
  return <GuidelinesShell>{children}</GuidelinesShell>;
}
