"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAppState } from "@/lib/dirac/store";

export default function ComposePage() {
  const router = useRouter();
  const { setComposeOpen, setComposeMinimized } = useAppState();

  useEffect(() => {
    setComposeOpen(true);
    setComposeMinimized(false);
    router.replace("/inbox");
  }, [router, setComposeOpen, setComposeMinimized]);

  return null;
}
