import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCircle2, ShieldCheck } from "lucide-react";
import { getAuth } from "@/lib/auth";
import { ROLE_HOME } from "@/lib/constants";
import { Wordmark } from "@/components/brand";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Secure Login" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; expired?: string; reset?: string }> }) {
  const sp = await searchParams;
  const auth = await getAuth();
  if (auth) redirect(ROLE_HOME[auth.user.role]);
  const next = sp.next && sp.next.startsWith("/") && !sp.next.startsWith("//") ? sp.next : undefined;

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      <div className="relative hidden overflow-hidden bg-brand-950 lg:block">
        <div className="bg-grid absolute inset-0 opacity-40" />
        <div className="absolute -top-32 -left-24 size-[480px] rounded-full bg-brand-600/40 blur-3xl" />
        <div className="absolute -right-20 bottom-0 size-[380px] rounded-full bg-accent-500/20 blur-3xl" />
        <div className="relative flex h-full flex-col justify-between p-12 text-white">
          <Link href="/">
            <Wordmark light />
          </Link>
          <div className="max-w-lg">
            <h1 className="text-4xl leading-tight font-extrabold tracking-tight">One portal for the complete NEP 2020 internship journey.</h1>
            <p className="mt-4 text-brand-200">Students, colleges, mentors and administrators work from a single, secure system — from verified registration to QR-verified certificates.</p>
            <ul className="mt-8 space-y-3 text-sm text-brand-100">
              {["College-verified student registration", "Learning, attendance and logbook in one place", "Mentor reviews and assessments", "QR-verified certificates and marksheets"].map((x) => (
                <li key={x} className="flex items-center gap-2.5">
                  <CheckCircle2 className="size-5 text-accent-400" /> {x}
                </li>
              ))}
            </ul>
          </div>
          <p className="text-xs text-brand-300">© {new Date().getFullYear()} MSY College · MSME Registered · ISO 9001:2015</p>
        </div>
      </div>

      <div className="flex flex-col justify-center px-5 py-10 sm:px-10">
        <div className="mx-auto w-full max-w-md">
          <Link href="/" className="mb-10 inline-block lg:hidden">
            <Wordmark />
          </Link>
          <div className="mb-8">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700">
              <ShieldCheck className="size-3.5" /> Secure login
            </span>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900">Welcome back</h2>
            <p className="mt-1.5 text-sm text-slate-500">Sign in with your username, email or MSY College registration number.</p>
          </div>
          <LoginForm next={next} expired={sp.expired === "1"} reset={sp.reset === "1"} />
          <p className="mt-8 text-center text-sm text-slate-500">
            New student?{" "}
            <Link href="/register" className="font-semibold text-brand-600 hover:text-brand-700">
              Apply for internship
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
