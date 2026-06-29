import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { AdminSessionBar } from "../../components/admin-session-bar";
import { loadPlatformSuperadminContext } from "../../lib/platform-auth";

type PlatformLayoutProps = {
  readonly children: ReactNode;
};

export default async function PlatformLayout({ children }: PlatformLayoutProps) {
  let context;

  try {
    context = await loadPlatformSuperadminContext();
  } catch {
    redirect("/login");
  }

  return (
    <div>
      <AdminSessionBar session={context.session} showPlatformLink={false} />
      {children}
    </div>
  );
}
