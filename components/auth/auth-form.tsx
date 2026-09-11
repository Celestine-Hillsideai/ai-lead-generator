"use client";

import { useActionState } from "react";
import { Button } from "../ui/button";
import { Input, Label } from "../ui/input";

type AuthActionState = { error?: string };
type AuthAction = (formData: FormData) => Promise<AuthActionState>;

export function AuthForm({ action, submitLabel }: { action: AuthAction; submitLabel: string }) {
  const [state, formAction, pending] = useActionState<AuthActionState, FormData>(
    async (_prevState, formData) => action(formData),
    {}
  );

  return (
    <form action={formAction} className="space-y-4 rounded-[var(--radius-card)] border border-border bg-paper-raised p-6">
      <div>
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </div>
      <div>
        <Label htmlFor="password">Password</Label>
        <Input id="password" name="password" type="password" autoComplete="current-password" required minLength={6} />
      </div>
      {state.error && <p className="text-sm text-danger">{state.error}</p>}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Please wait…" : submitLabel}
      </Button>
    </form>
  );
}
