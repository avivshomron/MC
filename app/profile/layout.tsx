import { AppShell } from "@/components/app-shell";
import { RequireAuth } from "@/components/require-auth";

export default function ProfileLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth>
      <AppShell>{children}</AppShell>
    </RequireAuth>
  );
}
