"use client";

import { useEffect, useState, type MouseEvent } from "react";

type Photo = {
  id: number;
  public_url: string;
  sort_order: number;
  is_cover: boolean;
};

export default function ListingPhotoGallery({
  photos,
  title,
}: {
  photos: Photo[];
  title: string;
}) {
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const activePhoto = viewerIndex !== null ? photos[viewerIndex] : null;
  const hasMultiplePhotos = photos.length > 1;
  const text = {
    openPhoto: (index: number) => `Open photo ${index}`,
    viewerLabel: "Listing photos",
    closeViewer: "Close photo viewer",
    previousPhoto: "Previous photo",
    nextPhoto: "Next photo",
    photoLabel: (index: number, total: number) => `Photo ${index}${total > 1 ? ` / ${total}` : ""}`,
  };

  useEffect(() => {
    if (viewerIndex === null) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setViewerIndex(null);
        return;
      }
      if (event.key === "ArrowRight") {
        setViewerIndex((current) => {
          if (current === null) return current;
          return (current + 1) % photos.length;
        });
      }
      if (event.key === "ArrowLeft") {
        setViewerIndex((current) => {
          if (current === null) return current;
          return (current - 1 + photos.length) % photos.length;
        });
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [photos.length, viewerIndex]);

  function showNextPhoto() {
    setViewerIndex((current) => {
      if (current === null) return current;
      return (current + 1) % photos.length;
    });
  }

  function showPreviousPhoto() {
    setViewerIndex((current) => {
      if (current === null) return current;
      return (current - 1 + photos.length) % photos.length;
    });
  }

  function handlePreviewImageClick(event: MouseEvent<HTMLImageElement>) {
    if (!hasMultiplePhotos) {
      return;
    }

    const bounds = event.currentTarget.getBoundingClientRect();
    const clickOffset = event.clientX - bounds.left;

    if (clickOffset < bounds.width / 2) {
      showPreviousPhoto();
      return;
    }

    showNextPhoto();
  }

  return (
    <>
      <div className="photo-grid">
        {photos.map((photo, index) => (
          <button
            key={photo.id}
            type="button"
            className="photo-grid-button"
            onClick={() => setViewerIndex(index)}
            aria-label={text.openPhoto(index + 1)}
          >
            <img src={photo.public_url} alt={title} loading="lazy" />
          </button>
        ))}
      </div>

      {activePhoto ? (
        <div className="photo-viewer" role="dialog" aria-modal="true" aria-label={text.viewerLabel}>
          <button type="button" className="photo-viewer-backdrop" onClick={() => setViewerIndex(null)} aria-label={text.closeViewer} />
          <div className="photo-viewer-card">
            <button
              type="button"
              className="photo-viewer-close"
              onClick={() => setViewerIndex(null)}
              aria-label={text.closeViewer}
            >
              x
            </button>
            {hasMultiplePhotos ? (
              <button
                type="button"
                className="photo-viewer-nav photo-viewer-prev"
                onClick={showPreviousPhoto}
                aria-label={text.previousPhoto}
                dir="ltr"
              >
                ‹
              </button>
            ) : null}
            <img
              className={`photo-viewer-image${hasMultiplePhotos ? " photo-viewer-image-interactive" : ""}`}
              src={activePhoto.public_url}
              alt={title}
              onClick={handlePreviewImageClick}
            />
            {hasMultiplePhotos ? (
              <button
                type="button"
                className="photo-viewer-nav photo-viewer-next"
                onClick={showNextPhoto}
                aria-label={text.nextPhoto}
                dir="ltr"
              >
                ›
              </button>
            ) : null}
            <p className="photo-viewer-caption">
              {text.photoLabel(viewerIndex! + 1, photos.length)}
            </p>
          </div>
        </div>
      ) : null}
    </>
  );
}
