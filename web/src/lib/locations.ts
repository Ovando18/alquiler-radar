/**
 * Hierarquia Comunidad Autónoma → Provincia → Municipios principais.
 * O campo "Cidade" também aceita texto livre; o microserviço gera o slug de cada portal.
 */
export type Provincia = { nombre: string; ciudades: string[] };
export type Comunidad = { nombre: string; provincias: Provincia[] };

export const COMUNIDADES: Comunidad[] = [
  {
    nombre: "Andalucía",
    provincias: [
      { nombre: "Almería", ciudades: ["Almería", "Roquetas de Mar", "El Ejido", "Mojácar"] },
      { nombre: "Cádiz", ciudades: ["Cádiz", "Jerez de la Frontera", "Algeciras", "San Fernando", "El Puerto de Santa María", "Chiclana de la Frontera"] },
      { nombre: "Córdoba", ciudades: ["Córdoba", "Lucena", "Puente Genil"] },
      { nombre: "Granada", ciudades: ["Granada", "Motril", "Almuñécar", "Armilla"] },
      { nombre: "Huelva", ciudades: ["Huelva", "Lepe", "Isla Cristina"] },
      { nombre: "Jaén", ciudades: ["Jaén", "Linares", "Úbeda"] },
      { nombre: "Málaga", ciudades: ["Málaga", "Marbella", "Fuengirola", "Torremolinos", "Benalmádena", "Estepona", "Mijas", "Vélez-Málaga", "Nerja"] },
      { nombre: "Sevilla", ciudades: ["Sevilla", "Dos Hermanas", "Alcalá de Guadaíra", "Mairena del Aljarafe"] },
    ],
  },
  {
    nombre: "Aragón",
    provincias: [
      { nombre: "Huesca", ciudades: ["Huesca", "Jaca", "Monzón"] },
      { nombre: "Teruel", ciudades: ["Teruel", "Alcañiz"] },
      { nombre: "Zaragoza", ciudades: ["Zaragoza", "Calatayud", "Utebo"] },
    ],
  },
  { nombre: "Principado de Asturias", provincias: [{ nombre: "Asturias", ciudades: ["Oviedo", "Gijón", "Avilés", "Llanes"] }] },
  { nombre: "Illes Balears", provincias: [{ nombre: "Illes Balears", ciudades: ["Palma", "Ibiza / Eivissa", "Calvià", "Manacor", "Maó / Mahón", "Santa Eulària des Riu"] }] },
  {
    nombre: "Canarias",
    provincias: [
      { nombre: "Las Palmas", ciudades: ["Las Palmas de Gran Canaria", "Telde", "Arrecife", "Puerto del Rosario", "San Bartolomé de Tirajana"] },
      { nombre: "Santa Cruz de Tenerife", ciudades: ["Santa Cruz de Tenerife", "San Cristóbal de La Laguna", "Arona", "Adeje", "Puerto de la Cruz"] },
    ],
  },
  { nombre: "Cantabria", provincias: [{ nombre: "Cantabria", ciudades: ["Santander", "Torrelavega", "Castro-Urdiales"] }] },
  {
    nombre: "Castilla-La Mancha",
    provincias: [
      { nombre: "Albacete", ciudades: ["Albacete", "Hellín"] },
      { nombre: "Ciudad Real", ciudades: ["Ciudad Real", "Puertollano", "Tomelloso"] },
      { nombre: "Cuenca", ciudades: ["Cuenca"] },
      { nombre: "Guadalajara", ciudades: ["Guadalajara", "Azuqueca de Henares"] },
      { nombre: "Toledo", ciudades: ["Toledo", "Talavera de la Reina", "Illescas", "Seseña"] },
    ],
  },
  {
    nombre: "Castilla y León",
    provincias: [
      { nombre: "Ávila", ciudades: ["Ávila"] },
      { nombre: "Burgos", ciudades: ["Burgos", "Miranda de Ebro", "Aranda de Duero"] },
      { nombre: "León", ciudades: ["León", "Ponferrada", "San Andrés del Rabanedo"] },
      { nombre: "Palencia", ciudades: ["Palencia"] },
      { nombre: "Salamanca", ciudades: ["Salamanca"] },
      { nombre: "Segovia", ciudades: ["Segovia"] },
      { nombre: "Soria", ciudades: ["Soria"] },
      { nombre: "Valladolid", ciudades: ["Valladolid", "Laguna de Duero"] },
      { nombre: "Zamora", ciudades: ["Zamora"] },
    ],
  },
  {
    nombre: "Cataluña",
    provincias: [
      { nombre: "Barcelona", ciudades: ["Barcelona", "L'Hospitalet de Llobregat", "Badalona", "Terrassa", "Sabadell", "Mataró", "Sant Cugat del Vallès", "Castelldefels", "Sitges", "Granollers"] },
      { nombre: "Girona", ciudades: ["Girona", "Figueres", "Lloret de Mar", "Blanes"] },
      { nombre: "Lleida", ciudades: ["Lleida", "Balaguer"] },
      { nombre: "Tarragona", ciudades: ["Tarragona", "Reus", "Salou", "Cambrils", "Tortosa"] },
    ],
  },
  {
    nombre: "Comunidad Valenciana",
    provincias: [
      { nombre: "Alicante", ciudades: ["Alicante / Alacant", "Elche / Elx", "Torrevieja", "Orihuela", "Benidorm", "San Vicente del Raspeig", "Santa Pola", "Dénia", "Jávea / Xàbia", "Altea", "Calp / Calpe", "Villajoyosa"] },
      { nombre: "Castellón", ciudades: ["Castellón de la Plana", "Vila-real", "Benicàssim", "Vinaròs"] },
      { nombre: "Valencia", ciudades: ["València", "Torrent", "Gandia", "Paterna", "Sagunto", "Burjassot", "Mislata", "Alboraya"] },
    ],
  },
  {
    nombre: "Extremadura",
    provincias: [
      { nombre: "Badajoz", ciudades: ["Badajoz", "Mérida", "Don Benito"] },
      { nombre: "Cáceres", ciudades: ["Cáceres", "Plasencia"] },
    ],
  },
  {
    nombre: "Galicia",
    provincias: [
      { nombre: "A Coruña", ciudades: ["A Coruña", "Santiago de Compostela", "Ferrol", "Oleiros"] },
      { nombre: "Lugo", ciudades: ["Lugo"] },
      { nombre: "Ourense", ciudades: ["Ourense"] },
      { nombre: "Pontevedra", ciudades: ["Vigo", "Pontevedra", "Vilagarcía de Arousa"] },
    ],
  },
  {
    nombre: "Comunidad de Madrid",
    provincias: [
      { nombre: "Madrid", ciudades: ["Madrid", "Alcalá de Henares", "Móstoles", "Fuenlabrada", "Leganés", "Getafe", "Alcorcón", "Las Rozas de Madrid", "Pozuelo de Alarcón", "Majadahonda", "Alcobendas", "San Sebastián de los Reyes", "Torrejón de Ardoz"] },
    ],
  },
  { nombre: "Región de Murcia", provincias: [{ nombre: "Murcia", ciudades: ["Murcia", "Cartagena", "Lorca", "Molina de Segura", "San Javier", "Mazarrón"] }] },
  { nombre: "Comunidad Foral de Navarra", provincias: [{ nombre: "Navarra", ciudades: ["Pamplona / Iruña", "Tudela", "Barañáin"] }] },
  {
    nombre: "País Vasco",
    provincias: [
      { nombre: "Álava", ciudades: ["Vitoria-Gasteiz"] },
      { nombre: "Gipuzkoa", ciudades: ["Donostia / San Sebastián", "Irun", "Eibar"] },
      { nombre: "Bizkaia", ciudades: ["Bilbao", "Barakaldo", "Getxo"] },
    ],
  },
  { nombre: "La Rioja", provincias: [{ nombre: "La Rioja", ciudades: ["Logroño", "Calahorra"] }] },
  { nombre: "Ceuta", provincias: [{ nombre: "Ceuta", ciudades: ["Ceuta"] }] },
  { nombre: "Melilla", provincias: [{ nombre: "Melilla", ciudades: ["Melilla"] }] },
];

export const provinciasDe = (comunidad: string | null) =>
  COMUNIDADES.find((c) => c.nombre === comunidad)?.provincias ?? COMUNIDADES.flatMap((c) => c.provincias);

export const ciudadesDe = (comunidad: string | null, provincia: string | null) => {
  const provs = provinciasDe(comunidad);
  return (provincia ? provs.filter((p) => p.nombre === provincia) : provs).flatMap((p) => p.ciudades);
};

export const comunidadDaProvincia = (provincia: string) =>
  COMUNIDADES.find((c) => c.provincias.some((p) => p.nombre === provincia))?.nombre ?? null;
