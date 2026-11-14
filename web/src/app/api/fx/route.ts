import { NextResponse } from "next/server";

export const revalidate = 3600; // 1h

/** Cotação EUR→BRL: AwesomeAPI (Brasil) com fallback para Frankfurter (BCE). */
export async function GET() {
  try {
    const r = await fetch("https://economia.awesomeapi.com.br/json/last/EUR-BRL", { next: { revalidate: 3600 } });
    if (r.ok) {
      const j = await r.json();
      const bid = Number(j?.EURBRL?.bid);
      if (bid > 0) return NextResponse.json({ rate: bid, source: "AwesomeAPI", at: j.EURBRL.create_date });
    }
  } catch {}
  try {
    const r = await fetch("https://api.frankfurter.app/latest?from=EUR&to=BRL", { next: { revalidate: 3600 } });
    if (r.ok) {
      const j = await r.json();
      if (j?.rates?.BRL) return NextResponse.json({ rate: j.rates.BRL, source: "BCE / Frankfurter", at: j.date });
    }
  } catch {}
  return NextResponse.json({ rate: null, source: null, at: null }, { status: 503 });
}
