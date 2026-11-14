import { z } from "zod";
import { PORTALS } from "./types";

const num = z.number().nonnegative().max(1_000_000).nullable();
const portalIds = PORTALS.map((p) => p.id) as [string, ...string[]];

export const filtersSchema = z.object({
  comunidad: z.string().max(80).nullable(),
  provincia: z.string().max(80).nullable(),
  ciudad: z.string().max(80).nullable(),
  zonas: z.array(z.string().max(80)).max(10),
  habitaciones: z.array(z.enum(["0", "1", "2", "3", "4"])),
  tipos: z.array(z.enum(["piso", "atico", "duplex", "chalet", "bajo_jardin"])),
  contrato: z.enum(["larga", "temporada", "vacacional"]),
  precio_min: num,
  precio_max: num,
  metros_min: num,
  gastos_incluidos: z.boolean(),
  sin_comision: z.boolean(),
  particular: z.boolean(),
  amueblado: z.enum(["any", "amueblado", "sin_amueblar"]),
  cocina_equipada: z.boolean(),
  ascensor: z.boolean(),
  aire_acondicionado: z.boolean(),
  calefaccion: z.boolean(),
  terraza: z.boolean(),
  garaje: z.boolean(),
  mascotas: z.boolean(),
  publicado: z.enum(["any", "24h", "7d", "30d"]),
  portales: z.array(z.enum(portalIds)).min(1),
  max_paginas: z.number().int().min(1).max(3),
});
