import { AdminShell } from "../../../components/admin-shell";
import { CompanySettingsWorkspace } from "../../../components/company-settings-workspace";
import { formatChooseCompanyBlockedCopy } from "../../../lib/auth-utils";
import {
  COMPANY_SETTINGS_PAGE_DESCRIPTION,
  COMPANY_SETTINGS_PAGE_TITLE,
  type CompanyProfileRecord
} from "../../../lib/company-profile-utils";
import { SUPERVISOR_FORBIDDEN_MESSAGE, type CompanyAccessContext } from "../../../lib/supervisor-scope-utils";
import { apiGet, loadWorkspaceContext, WorkspaceApiError } from "../../../lib/workspace-auth";

export default async function SettingsPage() {
  try {
    const workspace = await loadWorkspaceContext();

    if (workspace.blocked) {
      return (
        <AdminShell title={COMPANY_SETTINGS_PAGE_TITLE} description={COMPANY_SETTINGS_PAGE_DESCRIPTION}>
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {formatChooseCompanyBlockedCopy()}
          </p>
        </AdminShell>
      );
    }

    const { cookieHeader, session, selectedCompany } = workspace;

    const [accessContext, profile] = await Promise.all([
      apiGet<CompanyAccessContext>(
        `/company-operations/companies/${selectedCompany.id}/access-context`,
        cookieHeader
      ),
      apiGet<CompanyProfileRecord>(
        `/company-operations/companies/${selectedCompany.id}/profile`,
        cookieHeader
      )
    ]);

    return (
      <AdminShell
        title={COMPANY_SETTINGS_PAGE_TITLE}
        description={`${COMPANY_SETTINGS_PAGE_DESCRIPTION} Active company: ${selectedCompany.name}.`}
        actions={
          <span className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-700">
            Signed in as {session.user.email}
          </span>
        }
      >
        <CompanySettingsWorkspace profile={profile} canEdit={accessContext.canManageCompany} />
      </AdminShell>
    );
  } catch (error) {
    if (error instanceof WorkspaceApiError && error.status === 403) {
      return (
        <AdminShell title={COMPANY_SETTINGS_PAGE_TITLE} description={COMPANY_SETTINGS_PAGE_DESCRIPTION}>
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {SUPERVISOR_FORBIDDEN_MESSAGE}
          </p>
        </AdminShell>
      );
    }

    return (
      <AdminShell title={COMPANY_SETTINGS_PAGE_TITLE} description={COMPANY_SETTINGS_PAGE_DESCRIPTION}>
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Unable to load company settings right now. Check that the API is running and try again.
        </p>
      </AdminShell>
    );
  }
}
