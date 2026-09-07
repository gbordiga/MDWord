"use client";

import { useLayoutEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";

export default function Page() {
  const [mounted, setMounted] = useState(false);

  useLayoutEffect(() => {
    setMounted(true);
    document.documentElement.classList.add("mdword-ready");
  }, []);

  if (!mounted) return null;
  return <AppShell />;
}
