import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { getTranslations } from "next-intl/server";
import { getPurchaseOrderDetail } from "@/features/purchase-orders/queries";
import { getShopSettings } from "@/features/settings/queries";
import { routing } from "@/i18n/routing";
import {
  PurchaseOrderDocument,
  type PurchaseOrderLabels,
} from "@/features/purchase-orders/components/PurchaseOrderDocument";

export const runtime = "nodejs";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // Read under the signed-in user's session: RLS returns nothing for an
  // order of another shop, or for a visitor without an account.
  const order = await getPurchaseOrderDetail(id);
  if (!order) {
    return NextResponse.json({ error: "purchase_order_not_found" }, { status: 404 });
  }

  const shop = await getShopSettings();
  const requestedLocale = request.nextUrl.searchParams.get("locale");
  const locale = routing.locales.find((l) => l === requestedLocale) ?? routing.defaultLocale;
  const t = await getTranslations({ locale, namespace: "PurchaseOrders" });

  const labels: PurchaseOrderLabels = {
    title: t("pdf_title"),
    reference: t("ref"),
    date: t("date"),
    supplier: t("supplier"),
    no_supplier: t("no_supplier"),
    article: t("article"),
    quantity: t("quantity"),
    shop_fallback: t("shop_fallback"),
  };

  const buffer = await renderToBuffer(<PurchaseOrderDocument order={order} shop={shop} labels={labels} locale={locale} />);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${order.reference}.pdf"`,
    },
  });
}
