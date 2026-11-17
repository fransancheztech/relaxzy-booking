// Word lists for the client-name checks of the old-data review page. Keys are folded (foldText),
// values are the usual Spanish spelling.

import { foldText } from "@/utils/text";

/**
 * Names and surnames that are normally written with an accent or ñ in Spanish. "Maria" → "María".
 * Only correct Spanish spellings belong here. Words that are also common unaccented spellings in
 * Spanish are left out: Victoria, Ruiz and Ortiz have no accent, and Alex is more often typed by
 * foreign clients. A suggestion is never applied without the reviewer.
 */
const ACCENTED = [
  // Given names
  "Adán", "Adrián", "Agustín", "Aída", "Álvaro", "Andrés", "Ángel", "Ángela", "Ángeles", "Asunción",
  "Bárbara", "Begoña", "Belén", "Benjamín", "Cándida", "César", "Concepción", "Cristóbal", "Damián",
  "Darío", "Débora", "Efraín", "Efrén", "Elías", "Eloísa", "Encarnación", "Estefanía", "Fabián",
  "Fátima", "Félix", "Fermín", "Germán", "Héctor", "Hernán", "Inés", "Iñaki", "Íñigo", "Iván",
  "Jesús", "Joaquín", "Jonás", "José", "Josué", "Julián", "Lázaro", "Lucía", "María", "Martín",
  "Matías", "Máximo", "Moisés", "Mónica", "Nicolás", "Noé", "Noemí", "Óscar", "Purificación",
  "Ramón", "Raúl", "Rocío", "Rosalía", "Rubén", "Salomé", "Sebastián", "Simón", "Sofía", "Tobías",
  "Tomás", "Tristán", "Valentín", "Verónica", "Víctor",
  // Surnames
  "Alemán", "Álvarez", "Aragón", "Avilés", "Báez", "Beltrán", "Benítez", "Cáceres", "Calderón",
  "Cañete", "Carreño", "Castañeda", "Castaño", "Catalán", "Chacón", "Chávez", "Colón", "Cortés",
  "Cuéllar", "Díaz", "Díez", "Domínguez", "Durán", "Falcón", "Fernández", "Galán", "Gálvez",
  "García", "Garzón", "Ginés", "Girón", "Gómez", "González", "Gutiérrez", "Guzmán", "Hernández",
  "Ibáñez", "Jiménez", "León", "López", "Marín", "Márquez", "Martínez", "Méndez", "Millán",
  "Montaño", "Muñiz", "Muñoz", "Núñez", "Ordóñez", "Páez", "Patiño", "Peláez", "Peña", "Peñalver",
  "Pérez", "Quiñones", "Ramírez", "Rincón", "Río", "Ríos", "Rodríguez", "Román", "Sáez", "Sánchez",
  "Solís", "Suárez", "Téllez", "Valdés", "Vázquez", "Velázquez", "Vélez", "Yáñez", "Zúñiga",
];

/** folded → Spanish spelling (lower case): "maria" → "maría". */
export const SPANISH_ACCENTED = new Map(ACCENTED.map((w) => [foldText(w), w.toLowerCase()]));

/**
 * Given names that commonly come second in a Spanish compound first name: José María, Miguel
 * Ángel, Mari Carmen, María del Mar. Names that are also common surnames (Martín, Cruz, Paz, Reyes,
 * Alba) are left out, so "María Martín" is still offered as name + surname.
 */
const COMPOUND_PARTS = [
  "Alberto", "Alejandro", "Amparo", "Ana", "Andrés", "Ángel", "Ángela", "Ángeles", "Antonio",
  "Asunción", "Auxiliadora", "Belén", "Carlos", "Carmela", "Carmelo", "Carmen", "Concepción",
  "Consuelo", "Cristina", "Dolores", "Eduardo", "Elena", "Emilio", "Encarnación", "Enrique",
  "Esperanza", "Eugenia", "Felipe", "Fernanda", "Fernando", "Francisco", "Gracia", "Ignacio",
  "Inmaculada", "Isabel", "Javier", "Jesús", "Joaquín", "José", "Josefa", "Juan", "Lourdes", "Lucía",
  "Luis", "Luisa", "Macarena", "Magdalena", "Manuel", "Mar", "María", "Mari", "Mª", "Mercedes",
  "Miguel", "Milagros", "Nieves", "Pablo", "Pedro", "Pilar", "Rafael", "Ramón", "Remedios", "Rocío",
  "Rosa", "Rosario", "Soledad", "Teresa", "Tomás", "Trinidad", "Vicente", "Victoria",
];

/** Folded given names that can be the second part of a compound first name. */
export const COMPOUND_NAME_PARTS = new Set(COMPOUND_PARTS.map(foldText));
