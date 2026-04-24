"use client";

import Link from "next/link";
import { useState } from "react";

type ListingPhoto = {
  public_url: string;
};

type HomeListingCardProps = {
  href: string;
  title: string;
  make: string;
  model: string;
  year: number;
  mileageText: string;
  priceText: string;
  metaText: string;
  winterLabel?: string;
  badges?: string[];
  photos?: ListingPhoto[];
};

function ChevronIcon({ direction }: { direction: "left" | "right" }) {
  return (
    <svg
      className="car-thumb-nav-icon"
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
    >
      <path
        d={direction === "left" ? "M12.5 4.5L7.5 10l5 5.5" : "M7.5 4.5l5 5.5-5 5.5"}
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function normalizeTitle(value: string): string {
  return value
    .toLowerCase()
    .replace(/\bfor sale\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export default function HomeListingCard({
  href,
  title,
  make,
  model,
  year,
  mileageText,
  priceText,
  metaText,
  winterLabel,
  badges = [],
  photos = [],
}: HomeListingCardProps) {
  const [photoIndex, setPhotoIndex] = useState(0);
  const hasMultiplePhotos = photos.length > 1;
  const activePhoto = photos[photoIndex]?.public_url ?? "";
  const titleKey = normalizeTitle(title);
  const generatedTitleKeys = new Set([
    normalizeTitle(`${make} ${model}`),
    normalizeTitle(`${year} ${make} ${model}`),
    normalizeTitle(`${make} ${model} ${year}`),
  ]);
  const shouldShowSubtitle = titleKey && !generatedTitleKeys.has(titleKey);

  function showPreviousPhoto(event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    setPhotoIndex((current) => (current - 1 + photos.length) % photos.length);
  }

  function showNextPhoto(event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    setPhotoIndex((current) => (current + 1) % photos.length);
  }

  return (
    <article className="car-card">
      <div className="car-media">
        <Link href={href} className="car-media-link">
          {activePhoto ? (
            <img className="car-thumb" src={activePhoto} alt={title} />
          ) : (
            <div className="car-thumb" aria-hidden="true" />
          )}
        </Link>
        {hasMultiplePhotos ? (
          <>
            <button
              type="button"
              className="car-thumb-nav car-thumb-nav-prev"
              onClick={showPreviousPhoto}
              aria-label="Previous photo"
              dir="ltr"
            >
              <ChevronIcon direction="left" />
            </button>
            <button
              type="button"
              className="car-thumb-nav car-thumb-nav-next"
              onClick={showNextPhoto}
              aria-label="Next photo"
              dir="ltr"
            >
              <ChevronIcon direction="right" />
            </button>
            <p className="car-thumb-count" aria-live="polite">
              {photoIndex + 1}/{photos.length}
            </p>
          </>
        ) : null}
      </div>

      <Link href={href} className="car-body car-card-link">
        <div className="car-card-head">
          <p className="car-price">{priceText}</p>
          {winterLabel ? <p className="winter-score-pill">{winterLabel}</p> : null}
        </div>
        <h3 className="car-title">{year} {make} {model}</h3>
        {shouldShowSubtitle ? (
          <p className="car-subtitle">{title}</p>
        ) : null}
        <div className="car-facts">
          <span>{mileageText}</span>
          <span>{metaText}</span>
        </div>
        {badges.length ? (
          <div className="winter-chip-row" aria-label="Niche signals">
            {badges.map((badge) => (
              <span className="winter-chip" key={badge}>{badge}</span>
            ))}
          </div>
        ) : null}
      </Link>
    </article>
  );
}
