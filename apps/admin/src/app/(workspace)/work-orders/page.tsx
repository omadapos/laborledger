import { redirect } from "next/navigation";

type WorkOrdersPageProps = {
  readonly searchParams?: Promise<{
    companyId?: string;
    status?: string;
    q?: string;
    serviceClientId?: string;
    locationId?: string;
  }>;
};

export default async function WorkOrdersPage({ searchParams }: WorkOrdersPageProps) {
  const query = (await searchParams) ?? {};
  const params = new URLSearchParams();

  if (query.status) {
    params.set("status", query.status);
  }
  if (query.q?.trim()) {
    params.set("q", query.q.trim());
  }
  if (query.serviceClientId) {
    params.set("serviceClientId", query.serviceClientId);
  }
  if (query.locationId) {
    params.set("locationId", query.locationId);
  }

  const suffix = params.toString();
  redirect(suffix ? `/jobs?${suffix}` : "/jobs");
}
