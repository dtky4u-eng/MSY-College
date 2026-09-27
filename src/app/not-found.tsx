import Link from "next/link";
import { Compass } from "lucide-react";
import { Logo } from "@/components/brand";
import { buttonClass } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-6 text-center">
      <Logo className="size-12" />
      <div className="mt-8 flex size-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
        <Compass className="size-7" />
      </div>
      <h1 className="mt-5 text-2xl font-bold text-slate-900">Page not found</h1>
      <p className="mt-2 max-w-md text-sm text-slate-500">The page you are looking for doesn&apos;t exist or may have moved.</p>
      <div className="mt-6 flex gap-2">
        <Link href="/" className={buttonClass("outline")}>
          Go to homepage
        </Link>
        <Link href="/login" className={buttonClass("primary")}>
          Sign in
        </Link>
      </div>
    </div>
  );
}
