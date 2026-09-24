import { Document, Page, View, Text, Image, StyleSheet } from "@react-pdf/renderer";
import type { ShopSettings } from "@/features/settings/queries";
import { DEFAULT_TIME_ZONE, formatDate } from "@/lib/format";
import { describeOrderedItem } from "../message";
import type { PurchaseOrderDetail } from "../queries";

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 10, fontFamily: "Helvetica", color: "#1a1a1a" },
  headerRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 24 },
  logo: { width: 48, height: 48, marginBottom: 6, objectFit: "contain" },
  shopName: { fontSize: 14, fontWeight: 700, marginBottom: 2 },
  muted: { color: "#666666" },
  title: { fontSize: 18, fontWeight: 700, marginBottom: 4, textAlign: "right" },
  section: { marginBottom: 16 },
  table: { marginTop: 8, borderWidth: 1, borderColor: "#e0e0e0" },
  tableHeaderRow: { flexDirection: "row", backgroundColor: "#f4f4f5", borderBottomWidth: 1, borderBottomColor: "#e0e0e0" },
  tableRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#f0f0f0" },
  th: { padding: 6, fontWeight: 700 },
  td: { padding: 6 },
  colArticle: { flex: 4 },
  colQty: { flex: 1, textAlign: "right" },
  footer: { position: "absolute", bottom: 24, left: 32, right: 32, fontSize: 8, color: "#999999", textAlign: "center" },
});

export type PurchaseOrderLabels = {
  title: string;
  reference: string;
  date: string;
  supplier: string;
  no_supplier: string;
  article: string;
  quantity: string;
  shop_fallback: string;
};

// The order a supplier receives: what to send and how many, no prices (the
// supplier quotes its own). Excluded draft lines are left out.
export function PurchaseOrderDocument({
  order,
  shop,
  labels,
  locale,
}: {
  order: PurchaseOrderDetail;
  shop: ShopSettings | null;
  labels: PurchaseOrderLabels;
  locale: string;
}) {
  const lines = order.lines.filter((line) => !line.excluded);
  const date = formatDate(order.sent_at ?? order.created_at, locale, shop?.timezone ?? DEFAULT_TIME_ZONE);

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
          </View>
          <View>
            <Text style={styles.title}>{labels.title}</Text>
            <Text style={{ textAlign: "right" }}>{labels.reference}: {order.reference}</Text>
            <Text style={{ textAlign: "right" }}>{labels.date}: {date}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.muted}>{labels.supplier}</Text>
          <Text>{order.supplier_name || labels.no_supplier}</Text>
          {order.supplier_phone && <Text style={styles.muted}>{order.supplier_phone}</Text>}
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeaderRow}>
            <Text style={[styles.th, styles.colArticle]}>{labels.article}</Text>
            <Text style={[styles.th, styles.colQty]}>{labels.quantity}</Text>
          </View>
          {lines.map((line) => (
            <View key={line.id} style={styles.tableRow}>
              <Text style={[styles.td, styles.colArticle]}>{describeOrderedItem(line)}</Text>
              <Text style={[styles.td, styles.colQty]}>{line.quantity}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.footer}>
          {shop?.shop_name || labels.shop_fallback} · {order.reference}
        </Text>
      </Page>
    </Document>
  );
}
