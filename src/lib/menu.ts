// ============================================================
// Drink Menu — ~120 common bar drinks with standard drink values
// for BAC estimation. volume_ml and abv are computed so that
// volume_ml * (abv / 100) * 0.789 ≈ standard_drinks * 14g.
// ============================================================

export type DrinkCategory =
  | "Beer"
  | "Wine"
  | "Shots"
  | "Mixed"
  | "Cocktails"
  | "Tropical"
  | "Party"
  | "Frozen"
  | "Seltzer"
  | "Non-Alc";

export interface MenuDrink {
  id: string;
  name: string;
  category: DrinkCategory;
  volume_ml: number;
  abv: number;
  standard_drinks: number;
}

// Compute ABV that produces the correct alcohol grams for a serving
function abvForStd(std: number, ml: number): number {
  if (std === 0) return 0;
  return Math.round(((std * 14) / (ml * 0.789)) * 1000) / 10;
}

// Serving sizes (ml)
const BEER_ML = 355;
const WINE_ML = 150;
const SHOT_ML = 44;
const BOMB_ML = 300;
const MIX_ML = 250;
const ROCKS_ML = 100;
const SOUR_ML = 150;
const TALL_ML = 250;
const TIKI_ML = 350;
const PARTY_ML = 400;
const FROZEN_ML = 350;
const CAN_ML = 355;

function d(
  id: string,
  name: string,
  category: DrinkCategory,
  ml: number,
  std: number,
): MenuDrink {
  return { id, name, category, volume_ml: ml, abv: abvForStd(std, ml), standard_drinks: std };
}

export const DRINK_MENU: MenuDrink[] = [
  // ── Beer ────────────────────────────────────
  d("light-beer", "Light Beer", "Beer", BEER_ML, 1),
  d("lager", "Lager", "Beer", BEER_ML, 1),
  d("pilsner", "Pilsner", "Beer", BEER_ML, 1),
  d("ipa", "IPA", "Beer", BEER_ML, 1),
  d("double-ipa", "Double IPA", "Beer", BEER_ML, 1.5),
  d("pale-ale", "Pale Ale", "Beer", BEER_ML, 1),
  d("amber-ale", "Amber Ale", "Beer", BEER_ML, 1),
  d("wheat-beer", "Wheat Beer / Hefeweizen", "Beer", BEER_ML, 1),
  d("belgian-ale", "Belgian Ale", "Beer", BEER_ML, 1),
  d("stout", "Stout", "Beer", BEER_ML, 1),
  d("porter", "Porter", "Beer", BEER_ML, 1),
  d("sour-beer", "Sour Beer", "Beer", BEER_ML, 1),
  d("hard-cider", "Hard Cider", "Beer", BEER_ML, 1),

  // ── Wine ────────────────────────────────────
  d("red-wine", "Red Wine", "Wine", WINE_ML, 1),
  d("white-wine", "White Wine", "Wine", WINE_ML, 1),
  d("rose", "Rosé", "Wine", WINE_ML, 1),
  d("sparkling-wine", "Sparkling Wine", "Wine", WINE_ML, 1),
  d("champagne", "Champagne", "Wine", WINE_ML, 1),
  d("prosecco", "Prosecco", "Wine", WINE_ML, 1),
  d("moscato", "Moscato", "Wine", WINE_ML, 1),
  d("dessert-wine", "Dessert Wine", "Wine", WINE_ML, 1.5),
  d("port", "Port", "Wine", WINE_ML, 1.5),

  // ── Shots ───────────────────────────────────
  d("vodka-shot", "Vodka Shot", "Shots", SHOT_ML, 1),
  d("tequila-shot", "Tequila Shot", "Shots", SHOT_ML, 1),
  d("whiskey-shot", "Whiskey Shot", "Shots", SHOT_ML, 1),
  d("rum-shot", "Rum Shot", "Shots", SHOT_ML, 1),
  d("gin-shot", "Gin Shot", "Shots", SHOT_ML, 1),
  d("fireball-shot", "Fireball Shot", "Shots", SHOT_ML, 1),
  d("jagermeister-shot", "Jägermeister Shot", "Shots", SHOT_ML, 1),
  d("patron-shot", "Patrón Shot", "Shots", SHOT_ML, 1),
  d("lemon-drop-shot", "Lemon Drop Shot", "Shots", SHOT_ML, 1),
  d("kamikaze-shot", "Kamikaze Shot", "Shots", SHOT_ML, 1),
  d("green-tea-shot", "Green Tea Shot", "Shots", SHOT_ML, 1),
  d("vegas-bomb", "Vegas Bomb", "Shots", BOMB_ML, 1.5),
  d("jagerbomb", "Jägerbomb", "Shots", BOMB_ML, 1.5),
  d("irish-car-bomb", "Irish Car Bomb", "Shots", BOMB_ML, 2),

  // ── Simple Mixed Drinks ─────────────────────
  d("vodka-soda", "Vodka Soda", "Mixed", MIX_ML, 1),
  d("vodka-cranberry", "Vodka Cranberry", "Mixed", MIX_ML, 1),
  d("vodka-tonic", "Vodka Tonic", "Mixed", MIX_ML, 1),
  d("screwdriver", "Screwdriver", "Mixed", MIX_ML, 1),
  d("cape-cod", "Cape Cod", "Mixed", MIX_ML, 1),
  d("greyhound", "Greyhound", "Mixed", MIX_ML, 1),
  d("salty-dog", "Salty Dog", "Mixed", MIX_ML, 1),
  d("gin-tonic", "Gin & Tonic", "Mixed", MIX_ML, 1),
  d("rum-coke", "Rum & Coke", "Mixed", MIX_ML, 1),
  d("whiskey-coke", "Whiskey & Coke", "Mixed", MIX_ML, 1),
  d("jack-coke", "Jack & Coke", "Mixed", MIX_ML, 1),
  d("whiskey-ginger", "Whiskey Ginger", "Mixed", MIX_ML, 1),
  d("tequila-soda", "Tequila Soda", "Mixed", MIX_ML, 1),
  d("tequila-sunrise", "Tequila Sunrise", "Mixed", TALL_ML, 1),
  d("cuba-libre", "Cuba Libre", "Mixed", MIX_ML, 1),

  // ── Cocktails (Classic + Modern) ────────────
  d("old-fashioned", "Old Fashioned", "Cocktails", ROCKS_ML, 1.5),
  d("manhattan", "Manhattan", "Cocktails", ROCKS_ML, 1.8),
  d("martini", "Martini", "Cocktails", ROCKS_ML, 1.8),
  d("dirty-martini", "Dirty Martini", "Cocktails", ROCKS_ML, 1.8),
  d("negroni", "Negroni", "Cocktails", ROCKS_ML, 1.8),
  d("boulevardier", "Boulevardier", "Cocktails", ROCKS_ML, 1.8),
  d("daiquiri", "Daiquiri", "Cocktails", SOUR_ML, 1.3),
  d("margarita", "Margarita", "Cocktails", SOUR_ML, 1.4),
  d("tom-collins", "Tom Collins", "Cocktails", TALL_ML, 1.3),
  d("french-75", "French 75", "Cocktails", SOUR_ML, 1.4),
  d("sidecar", "Sidecar", "Cocktails", SOUR_ML, 1.5),
  d("sazerac", "Sazerac", "Cocktails", ROCKS_ML, 1.8),
  d("vesper-martini", "Vesper Martini", "Cocktails", ROCKS_ML, 2),
  d("gimlet", "Gimlet", "Cocktails", SOUR_ML, 1.4),
  d("whiskey-sour", "Whiskey Sour", "Cocktails", SOUR_ML, 1.4),
  d("amaretto-sour", "Amaretto Sour", "Cocktails", SOUR_ML, 1.2),
  d("pisco-sour", "Pisco Sour", "Cocktails", SOUR_ML, 1.4),
  d("aviation", "Aviation", "Cocktails", SOUR_ML, 1.5),
  d("espresso-martini", "Espresso Martini", "Cocktails", SOUR_ML, 1.5),
  d("moscow-mule", "Moscow Mule", "Cocktails", TALL_ML, 1.3),
  d("kentucky-mule", "Kentucky Mule", "Cocktails", TALL_ML, 1.3),
  d("mexican-mule", "Mexican Mule", "Cocktails", TALL_ML, 1.3),
  d("aperol-spritz", "Aperol Spritz", "Cocktails", TALL_ML, 1.2),
  d("paloma", "Paloma", "Cocktails", TALL_ML, 1.4),
  d("paper-plane", "Paper Plane", "Cocktails", SOUR_ML, 1.6),
  d("penicillin", "Penicillin", "Cocktails", SOUR_ML, 1.6),
  d("naked-famous", "Naked & Famous", "Cocktails", SOUR_ML, 1.6),
  d("cosmopolitan", "Cosmopolitan", "Cocktails", SOUR_ML, 1.4),
  d("lemon-drop-martini", "Lemon Drop Martini", "Cocktails", SOUR_ML, 1.5),

  // ── Tiki / Tropical ─────────────────────────
  d("pina-colada", "Piña Colada", "Tropical", TIKI_ML, 1.8),
  d("mai-tai", "Mai Tai", "Tropical", TIKI_ML, 2),
  d("zombie", "Zombie", "Tropical", TIKI_ML, 3),
  d("hurricane", "Hurricane", "Tropical", TIKI_ML, 2.5),
  d("painkiller", "Painkiller", "Tropical", TIKI_ML, 2),
  d("blue-hawaiian", "Blue Hawaiian", "Tropical", TIKI_ML, 2),
  d("bahama-mama", "Bahama Mama", "Tropical", TIKI_ML, 2.5),
  d("jungle-bird", "Jungle Bird", "Tropical", TIKI_ML, 1.8),
  d("rum-runner", "Rum Runner", "Tropical", TIKI_ML, 2),
  d("scorpion", "Scorpion", "Tropical", TIKI_ML, 2.5),

  // ── Party / Club Drinks ─────────────────────
  d("long-island", "Long Island Iced Tea", "Party", PARTY_ML, 3),
  d("adios-mf", "Adios Motherfucker", "Party", PARTY_ML, 3),
  d("blue-motorcycle", "Blue Motorcycle", "Party", PARTY_ML, 3),
  d("tokyo-tea", "Tokyo Tea", "Party", PARTY_ML, 3),
  d("electric-lemonade", "Electric Lemonade", "Party", PARTY_ML, 2.5),
  d("trash-can", "Trash Can", "Party", PARTY_ML, 3),
  d("blue-lagoon", "Blue Lagoon", "Party", PARTY_ML, 2),
  d("grateful-dead", "Grateful Dead", "Party", PARTY_ML, 3),

  // ── Frozen Drinks ───────────────────────────
  d("frozen-margarita", "Frozen Margarita", "Frozen", FROZEN_ML, 1.5),
  d("frozen-strawberry-marg", "Frozen Strawberry Margarita", "Frozen", FROZEN_ML, 1.5),
  d("frozen-mango-marg", "Frozen Mango Margarita", "Frozen", FROZEN_ML, 1.5),
  d("frozen-daiquiri", "Frozen Daiquiri", "Frozen", FROZEN_ML, 1.5),
  d("frozen-pina-colada", "Frozen Piña Colada", "Frozen", FROZEN_ML, 1.5),
  d("miami-vice", "Miami Vice", "Frozen", FROZEN_ML, 2),
  d("frozen-rum-runner", "Frozen Rum Runner", "Frozen", FROZEN_ML, 2),

  // ── Hard Seltzers & Canned / RTD ────────────
  d("hard-seltzer", "Hard Seltzer", "Seltzer", CAN_ML, 1),
  d("white-claw", "White Claw", "Seltzer", CAN_ML, 1),
  d("truly", "Truly", "Seltzer", CAN_ML, 1),
  d("high-noon", "High Noon", "Seltzer", CAN_ML, 1),
  d("cutwater-margarita", "Cutwater Margarita", "Seltzer", CAN_ML, 1.5),
  d("cutwater-mai-tai", "Cutwater Mai Tai", "Seltzer", CAN_ML, 1.5),
  d("canned-mojito", "Canned Mojito", "Seltzer", CAN_ML, 1.5),
  d("canned-paloma", "Canned Paloma", "Seltzer", CAN_ML, 1.5),

  // ── Non-Alcoholic ───────────────────────────
  d("mocktail", "Mocktail", "Non-Alc", CAN_ML, 0),
  d("shirley-temple", "Shirley Temple", "Non-Alc", CAN_ML, 0),
  d("roy-rogers", "Roy Rogers", "Non-Alc", CAN_ML, 0),
  d("soda", "Soda", "Non-Alc", CAN_ML, 0),
  d("tonic", "Tonic", "Non-Alc", CAN_ML, 0),
  d("club-soda", "Club Soda", "Non-Alc", CAN_ML, 0),
  d("na-beer", "Non-Alcoholic Beer", "Non-Alc", CAN_ML, 0),
];

/** All categories in display order */
export const DRINK_CATEGORIES: DrinkCategory[] = [
  "Beer", "Wine", "Shots", "Mixed", "Cocktails",
  "Tropical", "Party", "Frozen", "Seltzer", "Non-Alc",
];

