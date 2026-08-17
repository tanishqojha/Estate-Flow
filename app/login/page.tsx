import { Suspense } from "react";
import type { Metadata } from "next";
import { LoginForm } from "@/app/login/login-form";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-6 py-12">
      <div className="mb-8 space-y-2 text-center">
        <h1 className="text-2xl font-bold tracking-tight">EstateFlow CRM</h1>
        <p className="text-sm text-muted-foreground">Sign in to your workspace</p>
      </div>
      <Suspense>
        <LoginForm />
      </Suspense>
    </main>
  );
}
