export type CarMake = {
  key: string;
  name: string;
  nameAr: string;
  domain: string; // used to generate favicon/logo URL
  models: string[];
};

function logo(domain: string) {
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
}

export const CAR_MAKES: CarMake[] = [
  {
    key: "toyota",
    name: "Toyota",
    nameAr: "تويوتا",
    domain: "toyota.com",
    models: ["Camry", "Corolla", "Land Cruiser", "Prado", "RAV4", "Fortuner", "Hilux", "Yaris", "Innova", "Avalon", "Sequoia", "Rush", "Rav4 Hybrid"],
  },
  {
    key: "hyundai",
    name: "Hyundai",
    nameAr: "هيونداي",
    domain: "hyundai.com",
    models: ["Sonata", "Elantra", "Tucson", "Santa Fe", "Accent", "Azera", "i10", "Palisade", "Creta", "Veloster"],
  },
  {
    key: "nissan",
    name: "Nissan",
    nameAr: "نيسان",
    domain: "nissan.com",
    models: ["Patrol", "Altima", "Maxima", "Sunny", "Pathfinder", "X-Trail", "Sentra", "Armada", "Kicks", "Murano", "Navara"],
  },
  {
    key: "kia",
    name: "Kia",
    nameAr: "كيا",
    domain: "kia.com",
    models: ["Sportage", "Sorento", "Optima", "Cerato", "Rio", "Carnival", "Stinger", "Telluride", "EV6", "K5"],
  },
  {
    key: "honda",
    name: "Honda",
    nameAr: "هوندا",
    domain: "honda.com",
    models: ["Accord", "Civic", "CR-V", "Pilot", "HR-V", "Odyssey", "Passport", "Ridgeline"],
  },
  {
    key: "lexus",
    name: "Lexus",
    nameAr: "لكزس",
    domain: "lexus.com",
    models: ["LX 600", "LX 570", "GX 460", "GX 550", "RX 350", "ES 350", "LS 500", "IS 300", "NX 300", "UX 200"],
  },
  {
    key: "gmc",
    name: "GMC",
    nameAr: "GMC",
    domain: "gmc.com",
    models: ["Yukon", "Tahoe", "Suburban", "Acadia", "Terrain", "Sierra", "Canyon", "Denali"],
  },
  {
    key: "chevrolet",
    name: "Chevrolet",
    nameAr: "شيفروليه",
    domain: "chevrolet.com",
    models: ["Tahoe", "Suburban", "Silverado", "Malibu", "Camaro", "Traverse", "Blazer", "Trailblazer", "Equinox"],
  },
  {
    key: "ford",
    name: "Ford",
    nameAr: "فورد",
    domain: "ford.com",
    models: ["F-150", "Explorer", "Edge", "Expedition", "Escape", "Mustang", "Ranger", "Bronco", "Maverick"],
  },
  {
    key: "bmw",
    name: "BMW",
    nameAr: "بي إم دبليو",
    domain: "bmw.com",
    models: ["3 Series", "5 Series", "7 Series", "X3", "X5", "X6", "X7", "M3", "M5", "i4", "iX"],
  },
  {
    key: "mercedes-benz",
    name: "Mercedes-Benz",
    nameAr: "مرسيدس بنز",
    domain: "mercedes-benz.com",
    models: ["C-Class", "E-Class", "S-Class", "GLC", "GLE", "GLS", "A-Class", "CLA", "G-Class", "EQS"],
  },
  {
    key: "mitsubishi",
    name: "Mitsubishi",
    nameAr: "ميتسوبيشي",
    domain: "mitsubishi-motors.com",
    models: ["Pajero", "Outlander", "Eclipse Cross", "ASX", "L200", "Lancer", "Galant"],
  },
  {
    key: "land-rover",
    name: "Land Rover",
    nameAr: "لاند روفر",
    domain: "landrover.com",
    models: ["Range Rover", "Range Rover Sport", "Range Rover Velar", "Discovery", "Defender", "Evoque"],
  },
  {
    key: "jeep",
    name: "Jeep",
    nameAr: "جيب",
    domain: "jeep.com",
    models: ["Grand Cherokee", "Wrangler", "Cherokee", "Renegade", "Gladiator", "Commander", "Compass"],
  },
  {
    key: "dodge",
    name: "Dodge",
    nameAr: "دودج",
    domain: "dodge.com",
    models: ["Charger", "Challenger", "Durango", "Journey", "Ram 1500", "Grand Caravan"],
  },
  {
    key: "volkswagen",
    name: "Volkswagen",
    nameAr: "فولكس واغن",
    domain: "vw.com",
    models: ["Golf", "Passat", "Tiguan", "Touareg", "Polo", "Arteon", "ID.4", "Taos"],
  },
  {
    key: "audi",
    name: "Audi",
    nameAr: "أودي",
    domain: "audi.com",
    models: ["A3", "A4", "A6", "A8", "Q3", "Q5", "Q7", "Q8", "RS4", "RS6", "e-tron"],
  },
  {
    key: "mazda",
    name: "Mazda",
    nameAr: "مازدا",
    domain: "mazda.com",
    models: ["CX-5", "CX-9", "CX-60", "Mazda3", "Mazda6", "CX-3", "MX-5"],
  },
  {
    key: "infiniti",
    name: "Infiniti",
    nameAr: "إنفينيتي",
    domain: "infinitiusa.com",
    models: ["QX80", "QX60", "QX50", "QX55", "Q50", "Q60"],
  },
  {
    key: "cadillac",
    name: "Cadillac",
    nameAr: "كاديلاك",
    domain: "cadillac.com",
    models: ["Escalade", "CT5", "CT4", "XT5", "XT6", "Lyriq"],
  },
  {
    key: "subaru",
    name: "Subaru",
    nameAr: "سوبارو",
    domain: "subaru.com",
    models: ["Outback", "Forester", "Impreza", "Legacy", "XV", "BRZ", "WRX"],
  },
  {
    key: "suzuki",
    name: "Suzuki",
    nameAr: "سوزوكي",
    domain: "suzuki.com",
    models: ["Grand Vitara", "Vitara", "Swift", "Jimny", "Ertiga", "Baleno"],
  },
];

export const MAKES_BY_KEY: Record<string, CarMake & { logoUrl: string }> = Object.fromEntries(
  CAR_MAKES.map((m) => [m.key, { ...m, logoUrl: logo(m.domain) }])
);

export function getLogoUrl(domain: string): string {
  return logo(domain);
}

export function findMake(name: string): (CarMake & { logoUrl: string }) | undefined {
  const key = name.trim().toLowerCase().replace(/\s+/g, "-");
  return MAKES_BY_KEY[key];
}
