import { NextResponse } from "next/server";
import { buildCsvTemplate } from "@/features/stock/csv";

export async function GET() {
  return new NextResponse(buildCsvTemplate(), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="modele-stock.csv"',
    },
  });
}
