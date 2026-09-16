import { createSupabaseServerClient } from "../../../lib/supabase/server";
import { getUserSettings } from "../../../lib/database/queries";
import { PageHeader } from "../../../components/layout/page-header";
import { Breadcrumbs } from "../../../components/layout/breadcrumbs";
import { SettingsForm } from "../../../components/settings/settings-form";

export default async function SettingsPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const settings = await getUserSettings(supabase, user.id);

  return (
    <div className="max-w-2xl">
      <Breadcrumbs items={[{ label: "Settings" }]} />
      <PageHeader title="Settings" description="Applies to every campaign you run." />
      <SettingsForm initial={settings} />
    </div>
  );
}
