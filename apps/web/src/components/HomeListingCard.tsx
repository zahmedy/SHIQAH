"use client";

import Link from "next/link";
import { useState } from "react";

import { useLocale } from "@/components/LocaleProvider";

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
  photos?: ListingPhoto[];
};

export default function HomeListingCard({
  href,
  title,
  make,
  model,
  year,
  mileageText,
  priceText,
  metaText,
  photos = [],
}: HomeListingCardProps) {
  const locale = useLocale();
  const [photoIndex, setPhotoIndex] = useState(0);
  const hasMultiplePhotos = photos.length > 1;
  const activePhoto = photos[photoIndex]?.public_url ?? "";

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
              aria-label={locale === "ar" ? "الصورة السابقة" : "Previous photo"}
            >
              ‹
            </button>
            <button
              type="button"
              className="car-thumb-nav car-thumb-nav-next"
              onClick={showNextPhoto}
              aria-label={locale === "ar" ? "الصورة التالية" : "Next photo"}
            >
              ›
            </button>
            <p className="car-thumb-count" aria-live="polite">
              {photoIndex + 1}/{photos.length}
            </p>
          </>
        ) : null}
      </div>

      <Link href={href} className="car-body car-card-link">
        <h3 className="car-title">{title}</h3>
        <p className="car-meta">{make} {model} • {year}</p>
        <p className="car-meta">{mileageText}</p>
        <div className="car-footer-row">
          <p className="car-price">{priceText}</p>
          <p className="car-footer-meta">{metaText}</p>
        </div>
      </Link>
    </article>
  );
}
