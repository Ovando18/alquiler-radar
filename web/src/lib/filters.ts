import type { Habitaciones, TipoInmueble, Contrato, Publicado } from "./types";

export const HABITACIONES_OPTS: { v: Habitaciones; label: string; hint: string }[] = [
  { v: "0", label: "Estudio / Loft", hint: "T0" },
  { v: "1", label: "T1", hint: "1 habitación" },
  { v: "2", label: "T2", hint: "2 habitaciones" },
  { v: "3", label: "T3", hint: "3 habitaciones" },
  { v: "4", label: "T4+", hint: "4+ habitaciones" },
];

export const TIPOS_OPTS: { v: TipoInmueble; label: string; es: string }[] = [
  { v: "piso", label: "Apartamento", es: "Piso" },
  { v: "atico", label: "Cobertura", es: "Ático" },
  { v: "duplex", label: "Duplex", es: "Dúplex" },
  { v: "chalet", label: "Casa independente", es: "Chalet" },
  { v: "bajo_jardin", label: "Térreo com jardim", es: "Bajo con jardín" },
];

export const CONTRATO_OPTS: { v: Contrato; label: string; es: string; hint: string }[] = [
  { v: "larga", label: "Contrato longo", es: "Larga temporada", hint: "Residência habitual — LAU" },
  { v: "temporada", label: "Temporário", es: "Alquiler de temporada", hint: "Meses, estudantes, nômades" },
  { v: "vacacional", label: "Curta temporada", es: "Alquiler vacacional", hint: "Dias / semanas" },
];

export const PUBLICADO_OPTS: { v: Publicado; label: string }[] = [
  { v: "any", label: "Qualquer data" },
  { v: "24h", label: "Últimas 24h" },
  { v: "7d", label: "Últimos 7 dias" },
  { v: "30d", label: "Último mês" },
];

export const FEATURE_OPTS = [
  { k: "cocina_equipada", label: "Cozinha equipada", es: "Cocina equipada" },
  { k: "ascensor", label: "Elevador", es: "Ascensor" },
  { k: "aire_acondicionado", label: "Ar-condicionado", es: "Aire acondicionado" },
  { k: "calefaccion", label: "Aquecimento", es: "Calefacción" },
  { k: "terraza", label: "Terraço / Varanda", es: "Terraza / Balcón" },
  { k: "garaje", label: "Garagem", es: "Garaje / Parking" },
  { k: "mascotas", label: "Aceita animais", es: "Admite mascotas" },
] as const;

export const CONDICOES_OPTS = [
  { k: "gastos_incluidos", label: "Despesas inclusas", es: "Gastos incluidos" },
  { k: "sin_comision", label: "Sem comissão", es: "Sin comisión de agencia" },
  { k: "particular", label: "Direto com proprietário", es: "Particular" },
] as const;
