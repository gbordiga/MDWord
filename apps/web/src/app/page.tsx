"use client";

import { useLayoutEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { isElectron } from "@/lib/host";

export default function Page() {
  const [mounted, setMounted] = useState(false);

  useLayoutEffect(() => {
    setMounted(true);
    document.documentElement.classList.add("mdword-ready");
    document.documentElement.classList.toggle("mdword-electron", isElectron());
  }, []);

  if (!mounted) return null;
  return <AppShell />;
}
