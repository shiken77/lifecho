import { Suspense } from "react";
import LoginContent from "./LoginContent";

function LoginFallback() {
  return (
    <div className="min-h-screen w-screen flex items-center justify-center bg-[#FEFCF6] paper-texture p-6">
      <div className="w-8 h-8 border-2 border-[#F4A261]/30 border-t-[#F4A261] rounded-full animate-spin" />
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginContent />
    </Suspense>
  );
}
