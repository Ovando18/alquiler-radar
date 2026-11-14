import { NextResponse, type NextRequest } from "next/server";
import ExcelJS from "exceljs";
import { getAccess } from "@/lib/auth";
import { EXPORT_COLUMNS, toCsv } from "@/lib/export";
import type { Listing } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const { decision } = await getAccess();
  if (!decision.ok) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { listings, format, title } = (await req.json()) as { listings: Listing[]; format: "xlsx" | "csv"; title?: string };
  if (!Array.isArray(listings) || listings.length > 5000) return NextResponse.json({ error: "invalid" }, { status: 400 });
  const stamp = new Date().toISOString().slice(0, 10);
  const base = `alquilerradar-${(title ?? "busca").toLowerCase().normalize("NFD").replace(/[^\w]+/g, "-")}-${stamp}`;

  if (format === "csv") {
    return new NextResponse(toCsv(listings), {
      headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${base}.csv"` },
    });
  }

  const wb = new ExcelJS.Workbook();
  wb.creator = "AlquilerRadar España";
  const ws = wb.addWorksheet("Imóveis", { views: [{ state: "frozen", ySplit: 1 }] });
  ws.columns = EXPORT_COLUMNS.map((c) => ({ header: c.header, key: c.key, width: c.width }));
  for (const l of listings) ws.addRow(Object.fromEntries(EXPORT_COLUMNS.map((c) => [c.key, c.get(l)])));

  const header = ws.getRow(1);
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFAA151B" } };
  header.alignment = { vertical: "middle" };
  header.height = 22;
  ws.getColumn("price").numFmt = '#,##0 "€"';
  ws.getColumn("price_m2").numFmt = '#,##0.0 "€"';
  ws.autoFilter = { from: "A1", to: { row: 1, column: EXPORT_COLUMNS.length } };
  ws.getColumn("url").eachCell((cell, row) => {
    if (row > 1 && typeof cell.value === "string") {
      cell.value = { text: cell.value, hyperlink: cell.value };
      cell.font = { color: { argb: "FF1D4ED8" }, underline: true };
    }
  });

  const buf = await wb.xlsx.writeBuffer();
  return new NextResponse(buf as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${base}.xlsx"`,
    },
  });
}
