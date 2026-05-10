"use client";

import { useState } from "react";

type ShareListingButtonProps = {
  title: string;
  menuItem?: boolean;
};

function getListingUrl() {
  const url = new URL(window.location.href);
  url.hash = "";
  return url.toString();
}

export default function ShareListingButton({ title, menuItem = false }: ShareListingButtonProps) {
  const [status, setStatus] = useState("");

  async function shareListing() {
    setStatus("");
    const url = getListingUrl();
    const shareData = { title, text: title, url };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
        return;
      }

      await navigator.clipboard.writeText(url);
      setStatus("Link copied");
      window.setTimeout(() => setStatus(""), 1800);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        return;
      }
      setStatus("Could not share");
      window.setTimeout(() => setStatus(""), 2200);
    }
  }

  return (
    <div className="listing-share-wrap">
      <button
        type="button"
        className={menuItem ? "listing-actions-menu-item" : "btn btn-secondary listing-share-button"}
        onClick={() => void shareListing()}
        aria-label="Share listing"
      >
        Share
      </button>
      {status ? <p className="listing-share-status" role="status">{status}</p> : null}
    </div>
  );
}
