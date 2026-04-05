"use client";

import { useSearchParams } from "next/navigation";
import JournalDetail from "./JournalDetail";

export default function ArchiveDetailClient() {
  const sp = useSearchParams();
  const id = sp.get("id") ?? "";
  return <JournalDetail id={id} />;
}
