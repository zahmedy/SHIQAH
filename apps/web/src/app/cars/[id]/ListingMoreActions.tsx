"use client";

import { useEffect, useRef, useState } from "react";

import ListingReportButton from "./ListingReportButton";
import ShareListingButton from "./ShareListingButton";

type ListingMoreActionsProps = {
  carId: number;
  ownerId: number;
  title: string;
};

export default function ListingMoreActions({ carId, ownerId, title }: ListingMoreActionsProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function closeOnOutsideClick(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  return (
    <div className="listing-more-actions" ref={menuRef}>
      <button
        type="button"
        className="btn btn-secondary listing-more-button"
        aria-label="More listing actions"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        ...
      </button>
      {open ? (
        <div className="listing-actions-menu">
          <ShareListingButton title={title} menuItem />
          <ListingReportButton carId={carId} ownerId={ownerId} menuItem />
        </div>
      ) : null}
    </div>
  );
}
