import { createSupabaseServerClient } from "../../lib/supabase/server";
import { Sidebar } from "../../components/layout/sidebar";
import { Topbar } from "../../components/layout/topbar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="flex">
      <Sidebar />
      <div className="flex min-h-screen flex-1 flex-col">
        <Topbar userEmail={user?.email ?? null} />
        <main className="flex-1 px-8 py-8">{children}</main>
      </div>
    </div>
  );
}
