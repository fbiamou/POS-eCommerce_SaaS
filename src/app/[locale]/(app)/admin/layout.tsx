import { notFound } from "next/navigation";
import { isPlatformAdmin, isPlatformAdminAccount } from "@/features/admin/queries";
import { AdminMfaGate } from "@/features/admin/components/AdminMfaGate";

// The WISHOP console opens only after the 6-digit code of the admin's
// authenticator app (migration admin_mfa): first time, the app is set up
// here; then the code is asked once per session.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  if (!(await isPlatformAdminAccount())) notFound();
  if (!(await isPlatformAdmin())) return <AdminMfaGate />;
  return children;
}
