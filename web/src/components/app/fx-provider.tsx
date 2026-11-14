"use client";
import { createContext, useContext, useEffect, useState } from "react";

type Fx = { rate: number | null; showBrl: boolean; setShowBrl: (v: boolean) => void; source: string | null };
const FxContext = createContext<Fx>({ rate: null, showBrl: false, setShowBrl: () => {}, source: null });

export function FxProvider({ children }: { children: React.ReactNode }) {
  const [rate, setRate] = useState<number | null>(null);
  const [source, setSource] = useState<string | null>(null);
  const [showBrl, setShow] = useState(false);

  useEffect(() => {
    try {
      setShow(localStorage.getItem("ar_show_brl") === "1");
    } catch {}
    fetch("/api/fx")
      .then((r) => r.json())
      .then((j) => {
        setRate(j.rate);
        setSource(j.source);
      })
      .catch(() => {});
  }, []);

  const setShowBrl = (v: boolean) => {
    setShow(v);
    try {
      localStorage.setItem("ar_show_brl", v ? "1" : "0");
    } catch {}
  };

  return <FxContext.Provider value={{ rate, showBrl, setShowBrl, source }}>{children}</FxContext.Provider>;
}

export const useFx = () => useContext(FxContext);
