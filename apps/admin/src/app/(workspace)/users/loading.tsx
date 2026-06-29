import { AdminShell } from "../../../components/admin-shell";
import { USERS_PAGE_DESCRIPTION } from "../../../lib/user-invite-utils";

export default function UsersLoadingPage() {
  return (
    <AdminShell title="Users & invites" description={USERS_PAGE_DESCRIPTION}>
      <p className="text-sm text-slate-500">Loading invitations…</p>
    </AdminShell>
  );
}
