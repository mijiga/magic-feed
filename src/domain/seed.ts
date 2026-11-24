import gold from "../../gold/events.json" with { type: "json" };
import type { Place, Source } from "./types.js";

// Aliases come from the suburbs that hermanus.co.za lists, plus nearby areas that the gold set treats as Hermanus.
export const PLACES: Place[] = [
  {
    id: "hermanus",
    name: "Hermanus",
    country: "South Africa",
    timezone: "Africa/Johannesburg",
    aliases: [
      "Hermanus",
      "Onrus",
      "Sandbaai",
      "Vermont",
      "Fisherhaven",
      "Hawston",
      "Voelklip",
      "Voëlklip",
      "Hemel-en-Aarde",
      "Benguela Cove",
      "Bot River Lagoon",
    ],
  },
];

export const SOURCES: Source[] = [
  {
    id: "village-news",
    name: "The Village NEWS events calendar",
    url: "https://thevillagenews.co.za/wp-json/tribe/events/v1/events",
    kind: "listing",
    place_id: "hermanus",
    active: true,
  },
];

// The approved vocabulary is the one the user approved with the gold set.
export const APPROVED_VOCABULARY = gold.vocabulary;
