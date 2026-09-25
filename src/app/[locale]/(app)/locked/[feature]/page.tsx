import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getCurrentProfile } from "@/features/auth/actions";
import { getShopAccess } from "@/features/billing/access";
import { FEATURE_PLAN, type PlanFeature } from "@/features/billing/plans";
import { LockedFeature } from "@/features/billing/components/LockedFeature";

export async function generateMetadata({ params }: { params: Promise<{ feature: string }> }) {
  const { feature } = await params;
  const t = await getTranslations("Plans");
  return { title: feature in FEATURE_PLAN ? t(`feature_${feature}`) : t("banner_link") };
}

// Where a locked button leads (e.g. "Crédit" at the till on Standard): the
// same explanation as a locked page, so the owner knows it is the plan, not
// a fault of the app.
export default async function LockedFeaturePage({ params }: { params: Promise<{ feature: string }> }) {
  const { feature } = await params;
  if (!(feature in FEATURE_PLAN)) notFound();
  const [access, profile] = await Promise.all([getShopAccess(), getCurrentProfile()]);
  return <LockedFeature feature={feature as PlanFeature} currentPlan={access.plan} isManager={profile?.role === "MANAGER"} />;
}
