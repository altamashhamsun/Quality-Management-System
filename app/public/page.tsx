"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function PublicIndex() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/public/ncrs");
  }, [router]);

  return <p className="text-sm text-zinc-500">Opening Public View...</p>;
}
