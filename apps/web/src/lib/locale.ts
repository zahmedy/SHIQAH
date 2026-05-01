export type Locale = "en";

export const LOCALE_COOKIE = "nicherides_locale";

const VALUE_LABELS: Record<string, string> = {
  Sedan: "Sedan",
  SUV: "SUV",
  Coupe: "Coupe",
  Hatchback: "Hatchback",
  Pickup: "Pickup",
  Van: "Van",
  Wagon: "Wagon",
  Convertible: "Convertible",
  Automatic: "Automatic",
  Manual: "Manual",
  Petrol: "Gasoline",
  Hybrid: "Hybrid",
  Diesel: "Diesel",
  Electric: "Electric",
  FWD: "FWD",
  RWD: "RWD",
  AWD: "AWD",
  "4WD": "4WD",
  Used: "Used",
  New: "New",
  White: "White",
  Black: "Black",
  Silver: "Silver",
  Gray: "Gray",
  Blue: "Blue",
  Red: "Red",
  Green: "Green",
  Brown: "Brown",
  Beige: "Beige",
  Gold: "Gold",
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  pending_review: "Pending Review",
  active: "Active",
  sold: "Sold",
  rejected: "Rejected",
  expired: "Inactive",
};

const REVIEW_REASON_LABELS: Record<string, string> = {
  "Missing description.": "Missing description.",
  "Description is too short for auto-approval.": "Description is too short for auto-approval.",
  "At least 4 photos are required.": "At least 4 photos are required.",
  "External contact info is not allowed in the listing text.": "External contact info is not allowed in the listing text.",
  "Automatically approved.": "Automatically approved.",
};

const API_MESSAGE_LABELS: Record<string, string> = {
  "Invalid token": "Invalid token",
  "User not found or banned": "User not found or banned",
  "Admin only": "Admin only",
  "Invalid code (MVP accepts 0000)": "Invalid code (MVP accepts 0000)",
  "User is banned": "User is banned",
  "Not your listing": "Not your listing",
  "Not found": "Not found",
  "Photo not found": "Photo not found",
  "At least one field is required": "At least one field is required",
  "Name is required": "Name is required",
  "User ID must be 3-32 characters and use only letters, numbers, '.', '_' or '-'.": "User ID must be 3-32 characters and use only letters, numbers, '.', '_' or '-'.",
  "User ID is already taken": "User ID is already taken",
  "Invalid year": "Invalid year",
  "Invalid price": "Invalid price",
  "Latitude and longitude must be provided together": "Latitude and longitude must be provided together",
  "Invalid latitude": "Invalid latitude",
  "Invalid longitude": "Invalid longitude",
  "Only draft/pending/rejected/active/inactive can be edited": "Only draft/pending/rejected/active/inactive can be edited",
  "Only draft or inactive listings can be submitted": "Only draft or inactive listings can be submitted",
  "Only active listings can be marked sold": "Only active listings can be marked sold",
  "Invalid sold price": "Invalid sold price",
  "Missing description": "Missing description",
  "Missing description.": "Missing description.",
  "At least 4 photos required": "At least 4 photos required",
  "At least 4 photos are required.": "At least 4 photos are required.",
  "Listing not found": "Listing not found",
  "Invalid channel": "Invalid channel",
  "Provide at least one contact field": "Provide at least one contact field",
  "Invalid offer type": "Invalid offer type",
  "Invalid offer amount": "Invalid offer amount",
  "You cannot bid on your own listing": "You cannot bid on your own listing",
  "A verified phone number is required to bid": "A verified phone number is required to bid",
  "Bidding is closed for this listing": "Bidding is closed for this listing",
  "Only the listing owner can manage offers": "Only the listing owner can manage offers",
  "Only the listing owner can accept offers": "Only the listing owner can accept offers",
  "Only the listing owner can unaccept offers": "Only the listing owner can unaccept offers",
  "Offer not found": "Offer not found",
  "An offer has already been accepted for this listing": "An offer has already been accepted for this listing",
  "Offer is not currently accepted": "Offer is not currently accepted",
  "Only pending_review can be approved": "Only pending_review can be approved",
  "Only pending_review can be rejected": "Only pending_review can be rejected",
  "Message cannot be empty": "Message cannot be empty",
  "User not found": "User not found",
};

export function normalizeLocale(_value?: string | null): Locale {
  return "en";
}

export function getDirection(_locale: Locale): "ltr" {
  return "ltr";
}

export function getLocaleTag(_locale: Locale): string {
  return "en-US";
}

export function formatNumber(value: number, locale: Locale): string {
  return new Intl.NumberFormat(getLocaleTag(locale)).format(value);
}

export function formatPrice(value: number, locale: Locale): string {
  return new Intl.NumberFormat(getLocaleTag(locale), {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatListingPrice(value: number | null | undefined, locale: Locale): string {
  if (value === undefined || value === null) {
    return "Best offer";
  }
  return formatPrice(value, locale);
}

export function formatDistance(value: number, locale: Locale): string {
  const miles = Math.round(value * 0.621371);
  return `${formatNumber(miles, locale)} mi`;
}

export function formatMileage(value: number | undefined, locale: Locale): string {
  if (value === undefined || value === null) {
    return "Mileage not set";
  }
  return formatDistance(value, locale);
}

export function formatRelativeHours(value: string | undefined, _locale: Locale): string {
  if (!value) {
    return "Recently";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Recently";
  }

  const diffHours = Math.max(1, Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60)));
  return `${diffHours}h ago`;
}

export function formatShortDate(value: string, locale: Locale): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Unknown date";
  }

  return date.toLocaleDateString(getLocaleTag(locale), {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatDateTime(value: string | undefined, locale: Locale): string {
  if (!value) {
    return "Recently";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Recently";
  }

  return date.toLocaleString(getLocaleTag(locale), {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatClockTime(value: string, locale: Locale): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleTimeString(getLocaleTag(locale), {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function translateValue(_locale: Locale, value?: string | number | null): string {
  if (value === null || value === undefined || value === "") {
    return "—";
  }

  const key = String(value);
  return VALUE_LABELS[key] ?? key;
}

export function translateStatus(_locale: Locale, value: string): string {
  return STATUS_LABELS[value] ?? value;
}

export function translateReviewReason(_locale: Locale, value?: string | null): string {
  if (!value) {
    return "";
  }

  return REVIEW_REASON_LABELS[value] ?? value;
}

export function translateApiMessage(locale: Locale, value?: string | null): string {
  if (!value) {
    return "";
  }

  const exact = API_MESSAGE_LABELS[value] ?? REVIEW_REASON_LABELS[value];
  if (exact) {
    return exact;
  }

  const highestBidMatch = value.match(/^Your bid must be higher than the current highest bid of (\d+) (?:SAR|USD)$/);
  if (highestBidMatch) {
    return `Your bid must be higher than the current highest bid of ${formatPrice(Number(highestBidMatch[1]), locale)}.`;
  }

  const failedStatusMatch = value.match(/^Failed with status (\d+)$/);
  if (failedStatusMatch) {
    return value;
  }

  const searchUnavailableMatch = value.match(/^Search service unavailable\. Start OpenSearch at (.+)\.$/);
  if (searchUnavailableMatch) {
    return value;
  }

  return value;
}
