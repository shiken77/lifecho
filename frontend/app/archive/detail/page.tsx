import { Suspense } from "react";
import ArchiveDetailClient from "./ArchiveDetailClient";

function DetailFallback() {
  return (
    <div className="h-screen w-screen bg-[#FEFCF6] paper-texture flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-[#F4A261]/30 border-t-[#F4A261] rounded-full animate-spin" />
    </div>
  );
}

/** 静态导出：用客户端读取 ?id=，避免 server searchParams 无法预渲染 */
export default function ArchiveDetailPage() {
  return (
    <Suspense fallback={<DetailFallback />}>
      <ArchiveDetailClient />
    </Suspense>
  );
}
