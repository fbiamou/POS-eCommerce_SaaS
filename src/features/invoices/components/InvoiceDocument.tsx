import { Document, Page, View, Text, Image, StyleSheet } from "@react-pdf/renderer";
import type { InvoiceDetail } from "../actions";
import type { ShopSettings } from "@/features/settings/queries";
import { DEFAULT_TIME_ZONE, formatDate, formatMoney } from "@/lib/format";
import { extractVat } from "../actions";

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 10, fontFamily: "Helvetica", color: "#1a1a1a" },
  headerRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 24 },
  logo: { width: 48, height: 48, marginBottom: 6, objectFit: "contain" },
  shopName: { fontSize: 14, fontWeight: 700, marginBottom: 2 },
  muted: { color: "#666666" },
  invoiceTitle: { fontSize: 18, fontWeight: 700, marginBottom: 4, textAlign: "right" },
  section: { marginBottom: 16 },
  row: { flexDirection: "row" },
  label: { color: "#666666", width: 90 },
  table: { marginTop: 8, borderWidth: 1, borderColor: "#e0e0e0" },
  tableHeaderRow: { flexDirection: "row", backgroundColor: "#f4f4f5", borderBottomWidth: 1, borderBottomColor: "#e0e0e0" },
  tableRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#f0f0f0" },
  th: { padding: 6, fontWeight: 700 },
  td: { padding: 6 },
  colArticle: { flex: 3 },
  colQty: { flex: 1, textAlign: "right" },
  colPrice: { flex: 1.5, textAlign: "right" },
  colTotal: { flex: 1.5, textAlign: "right" },
  totals: { marginTop: 16, alignSelf: "flex-end", width: 220 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2 },
  totalRowStrong: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4, borderTopWidth: 1, borderTopColor: "#1a1a1a", marginTop: 4, fontWeight: 700 },
  footer: { position: "absolute", bottom: 24, left: 32, right: 32, fontSize: 8, color: "#999999", textAlign: "center" },
});

export type InvoiceLabels = {
  title: string;
  invoice_number: string;
  date: string;
  client: string;
  walk_in_client: string;
  article: string;
  quantity: string;
  unit_price: string;
  total: string;
  subtotal_ht: string;
  subtotal: string;
  loyalty_discount: string;
  vat: string;
  total_ttc: string;
  paid_amount: string;
  remaining_due: string;
  status: string;
  status_paid: string;
  status_partial: string;
  status_unpaid: string;
  tax_id_label: string;
  trade_register_label: string;
  shop_fallback: string;
};

const STATUS_KEY = {
  PAID: "status_paid",
  PARTIAL: "status_partial",
  UNPAID: "status_unpaid",
} as const;

// Same formatting as the screens (lib/format), with one adaptation: French
// digit grouping uses a narrow no-break space (U+202F) that the PDF's base
// Helvetica font cannot render (it shows a stray glyph). It becomes a regular
// no-break space (U+00A0), which Helvetica has and which still never breaks.
function pdfSafe(text: string) {
  return text.replace(/ /g, " ");
}

export function InvoiceDocument({
  invoice,
  shop,
  labels,
  locale,
}: {
  invoice: InvoiceDetail;
  shop: ShopSettings | null;
  labels: InvoiceLabels;
  locale: string;
}) {
  const currencySymbol = shop?.currency_symbol ?? "";
  const formatAmount = (value: number) => pdfSafe(formatMoney(value, currencySymbol, locale));
  const vatRateBps = shop?.vat_rate_bps ?? 1925;
  const { excludingVat, vatAmount } = shop?.vat_registered
    ? extractVat(invoice.total_amount, vatRateBps)
    : { excludingVat: invoice.total_amount, vatAmount: 0 };
  const remaining = invoice.total_amount - invoice.paid_amount;
  const invoiceDate = formatDate(invoice.created_at, locale, shop?.timezone ?? DEFAULT_TIME_ZONE);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.headerRow}>
          <View>
            {shop?.shop_logo_url && <Image src={shop.shop_logo_url} style={styles.logo} />}
            <Text style={styles.shopName}>{shop?.shop_name || labels.shop_fallback}</Text>
            {shop?.shop_address && <Text style={styles.muted}>{shop.shop_address}</Text>}
            {shop?.shop_phone && <Text style={styles.muted}>{shop.shop_phone}</Text>}
            {shop?.shop_email && <Text style={styles.muted}>{shop.shop_email}</Text>}
            {shop?.tax_id && <Text style={styles.muted}>{labels.tax_id_label}: {shop.tax_id}</Text>}
            {shop?.trade_register && <Text style={styles.muted}>{labels.trade_register_label}: {shop.trade_register}</Text>}
          </View>
          <View>
            <Text style={styles.invoiceTitle}>{labels.title}</Text>
            {invoice.invoice_number && <Text style={{ textAlign: "right" }}>{labels.invoice_number}: {invoice.invoice_number}</Text>}
            <Text style={{ textAlign: "right" }}>{labels.date}: {invoiceDate}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={{ fontWeight: 700, marginBottom: 2 }}>{labels.client}</Text>
          <Text>{invoice.client?.name || labels.walk_in_client}</Text>
          {invoice.client?.phone && <Text style={styles.muted}>{invoice.client.phone}</Text>}
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeaderRow}>
            <Text style={[styles.th, styles.colArticle]}>{labels.article}</Text>
            <Text style={[styles.th, styles.colQty]}>{labels.quantity}</Text>
            <Text style={[styles.th, styles.colPrice]}>{labels.unit_price}</Text>
            <Text style={[styles.th, styles.colTotal]}>{labels.total}</Text>
          </View>
          {invoice.items.map((item) => (
            <View key={item.id} style={styles.tableRow}>
              <Text style={[styles.td, styles.colArticle]}>{item.product_name}</Text>
              <Text style={[styles.td, styles.colQty]}>{item.quantity}</Text>
              <Text style={[styles.td, styles.colPrice]}>{formatAmount(item.unit_price)}</Text>
              <Text style={[styles.td, styles.colTotal]}>{formatAmount(item.total_price)}</Text>
            </View>
          ))}
        </View>

        <View style={styles.totals}>
          {invoice.discount_amount > 0 && (
            <>
              <View style={styles.totalRow}>
                <Text>{labels.subtotal}</Text>
                <Text>{formatAmount(invoice.total_amount + invoice.discount_amount)}</Text>
              </View>
              <View style={styles.totalRow}>
                <Text>{labels.loyalty_discount}</Text>
                <Text>-{formatAmount(invoice.discount_amount)}</Text>
              </View>
            </>
          )}
          {shop?.vat_registered && (
            <>
              <View style={styles.totalRow}>
                <Text>{labels.subtotal_ht}</Text>
                <Text>{formatAmount(excludingVat)}</Text>
              </View>
              <View style={styles.totalRow}>
                <Text>{labels.vat} ({(vatRateBps / 100).toFixed(2)}%)</Text>
                <Text>{formatAmount(vatAmount)}</Text>
              </View>
            </>
          )}
          <View style={styles.totalRowStrong}>
            <Text>{labels.total_ttc}</Text>
            <Text>{formatAmount(invoice.total_amount)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text>{labels.paid_amount}</Text>
            <Text>{formatAmount(invoice.paid_amount)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text>{labels.remaining_due}</Text>
            <Text>{formatAmount(remaining)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text>{labels.status}</Text>
            <Text>{labels[STATUS_KEY[invoice.status]]}</Text>
          </View>
        </View>

        <Text style={styles.footer} fixed>
          {shop?.shop_name || labels.shop_fallback}{shop?.shop_phone ? ` · ${shop.shop_phone}` : ""}
        </Text>
      </Page>
    </Document>
  );
}
