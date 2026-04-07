export type CarMake = {
  key: string;
  name: string;
  domain: string;
  models: string[];
};

function logo(domain: string) {
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
}

export const CAR_MAKES: CarMake[] = [
  {
    key: "toyota",
    name: "Toyota",
    domain: "toyota.com",
    models: ["Camry", "Corolla", "RAV4", "Highlander", "4Runner", "Tacoma", "Tundra", "Prius", "Sienna", "Sequoia", "Land Cruiser", "Crown"],
  },
  {
    key: "hyundai",
    name: "Hyundai",
    domain: "hyundai.com",
    models: ["Elantra", "Sonata", "Tucson", "Santa Fe", "Palisade", "Kona", "Venue", "Santa Cruz", "Ioniq 5", "Ioniq 6"],
  },
  {
    key: "nissan",
    name: "Nissan",
    domain: "nissan.com",
    models: ["Altima", "Sentra", "Versa", "Rogue", "Murano", "Pathfinder", "Armada", "Frontier", "Leaf", "Kicks", "Z"],
  },
  {
    key: "kia",
    name: "Kia",
    domain: "kia.com",
    models: ["K4", "K5", "Forte", "Soul", "Seltos", "Sportage", "Sorento", "Telluride", "Carnival", "EV6", "EV9"],
  },
  {
    key: "honda",
    name: "Honda",
    domain: "honda.com",
    models: ["Accord", "Civic", "CR-V", "HR-V", "Pilot", "Odyssey", "Passport", "Ridgeline", "Prologue"],
  },
  {
    key: "lexus",
    name: "Lexus",
    domain: "lexus.com",
    models: ["RX 350", "NX 350", "ES 350", "GX 550", "LX 600", "IS 350", "TX 350", "RC 350", "LS 500", "UX 300h"],
  },
  {
    key: "gmc",
    name: "GMC",
    domain: "gmc.com",
    models: ["Terrain", "Acadia", "Yukon", "Yukon XL", "Canyon", "Sierra 1500", "Sierra HD", "Hummer EV"],
  },
  {
    key: "chevrolet",
    name: "Chevrolet",
    domain: "chevrolet.com",
    models: ["Trax", "Trailblazer", "Equinox", "Blazer", "Traverse", "Tahoe", "Suburban", "Colorado", "Silverado 1500", "Malibu", "Corvette"],
  },
  {
    key: "ford",
    name: "Ford",
    domain: "ford.com",
    models: ["Maverick", "Ranger", "F-150", "Mustang", "Escape", "Bronco Sport", "Bronco", "Explorer", "Expedition", "Transit"],
  },
  {
    key: "tesla",
    name: "Tesla",
    domain: "tesla.com",
    models: ["Model 3", "Model Y", "Model S", "Model X", "Cybertruck"],
  },
  {
    key: "bmw",
    name: "BMW",
    domain: "bmw.com",
    models: ["2 Series", "3 Series", "4 Series", "5 Series", "7 Series", "X1", "X3", "X5", "X7", "i4", "iX"],
  },
  {
    key: "mercedes-benz",
    name: "Mercedes-Benz",
    domain: "mercedes-benz.com",
    models: ["C-Class", "E-Class", "S-Class", "GLA", "GLC", "GLE", "GLS", "EQB", "EQE", "G-Class"],
  },
  {
    key: "mitsubishi",
    name: "Mitsubishi",
    domain: "mitsubishi-motors.com",
    models: ["Mirage", "Outlander", "Outlander Sport", "Eclipse Cross"],
  },
  {
    key: "land-rover",
    name: "Land Rover",
    domain: "landrover.com",
    models: ["Range Rover", "Range Rover Sport", "Range Rover Velar", "Range Rover Evoque", "Discovery", "Defender"],
  },
  {
    key: "jeep",
    name: "Jeep",
    domain: "jeep.com",
    models: ["Compass", "Cherokee", "Grand Cherokee", "Wrangler", "Gladiator", "Wagoneer", "Grand Wagoneer"],
  },
  {
    key: "dodge",
    name: "Dodge",
    domain: "dodge.com",
    models: ["Hornet", "Durango", "Charger", "Challenger"],
  },
  {
    key: "ram",
    name: "Ram",
    domain: "ramtrucks.com",
    models: ["1500", "2500", "3500", "ProMaster"],
  },
  {
    key: "volkswagen",
    name: "Volkswagen",
    domain: "vw.com",
    models: ["Jetta", "Taos", "Tiguan", "Atlas", "Atlas Cross Sport", "Golf GTI", "Golf R", "ID.4"],
  },
  {
    key: "audi",
    name: "Audi",
    domain: "audi.com",
    models: ["A3", "A4", "A5", "A6", "Q3", "Q5", "Q7", "Q8", "e-tron", "Q4 e-tron"],
  },
  {
    key: "mazda",
    name: "Mazda",
    domain: "mazda.com",
    models: ["Mazda3", "CX-30", "CX-5", "CX-50", "CX-70", "CX-90", "MX-5 Miata"],
  },
  {
    key: "infiniti",
    name: "Infiniti",
    domain: "infinitiusa.com",
    models: ["Q50", "QX50", "QX55", "QX60", "QX80"],
  },
  {
    key: "cadillac",
    name: "Cadillac",
    domain: "cadillac.com",
    models: ["CT4", "CT5", "XT4", "XT5", "XT6", "Escalade", "Lyriq", "Optiq"],
  },
  {
    key: "subaru",
    name: "Subaru",
    domain: "subaru.com",
    models: ["Impreza", "Legacy", "WRX", "Crosstrek", "Forester", "Outback", "Ascent", "BRZ", "Solterra"],
  },
];

export const MAKES_BY_KEY: Record<string, CarMake & { logoUrl: string }> = Object.fromEntries(
  CAR_MAKES.map((m) => [m.key, { ...m, logoUrl: logo(m.domain) }]),
);

export function getLogoUrl(domain: string): string {
  return logo(domain);
}

export function findMake(name: string): (CarMake & { logoUrl: string }) | undefined {
  const key = name.trim().toLowerCase().replace(/\s+/g, "-");
  return MAKES_BY_KEY[key];
}
