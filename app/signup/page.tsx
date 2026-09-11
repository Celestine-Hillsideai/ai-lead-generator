import Link from "next/link";
import { AuthForm } from "../../components/auth/auth-form";
import { signUpAction } from "../actions/auth";

export default function SignupPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-paper px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="font-display text-2xl font-semibold text-ink">Create your account</h1>
          <p className="mt-1 text-sm text-ink-muted">Start researching and qualifying leads.</p>
        </div>
        <AuthForm action={signUpAction} submitLabel="Create account" />
        <p className="mt-6 text-center text-sm text-ink-muted">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-accent-500 hover:text-accent-600">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
