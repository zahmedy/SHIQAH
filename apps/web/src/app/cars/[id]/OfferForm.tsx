"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";

import { useLocale } from "@/components/LocaleProvider";
import { formatDateTime, formatPrice, translateApiMessage } from "@/lib/locale";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE;
const TOKEN_KEY = "autointel_access_token";

type OfferEntry = {
  id: number;
  amount: number;
  created_at: string;
  accepted_at: string | null;
  visibility: "public" | "private";
};

type OfferSummary = {
  highest_offer: number | null;
  offer_count: number;
  bidding_open: boolean;
  public_bidding_enabled: boolean;
  accepted_offer: OfferEntry | null;
  offers: OfferEntry[];
};

type OwnerOfferEntry = OfferEntry & {
  buyer_user_id: number | null;
  buyer_user_label: string | null;
  phone_e164: string | null;
};

type OwnerOfferSummary = {
  highest_offer: number | null;
  offer_count: number;
  bidding_open: boolean;
  public_bidding_enabled: boolean;
  accepted_offer: OwnerOfferEntry | null;
  offers: OwnerOfferEntry[];
};

type MeResponse = {
  id: number;
};

function isOwnerOfferEntry(offer: OfferEntry | OwnerOfferEntry): offer is OwnerOfferEntry {
  return "phone_e164" in offer;
}

function buildWhatsappUrl(phone: string, message: string) {
  return `https://wa.me/${phone.replace("+", "")}?text=${encodeURIComponent(message)}`;
}

export default function OfferForm({
  carId,
  ownerId,
  publicBiddingEnabled: publicBiddingEnabledProp,
}: {
  carId: number;
  ownerId: number;
  publicBiddingEnabled: boolean;
}) {
  const locale = useLocale();
  const [amount, setAmount] = useState("");
  const [token, setToken] = useState("");
  const [viewerId, setViewerId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [acceptingId, setAcceptingId] = useState<number | null>(null);
  const [unacceptingId, setUnacceptingId] = useState<number | null>(null);
  const [confirmAmount, setConfirmAmount] = useState<number | null>(null);
  const [confirmVisibility, setConfirmVisibility] = useState<"public" | "private" | null>(null);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<OfferSummary | null>(null);
  const [ownerSummary, setOwnerSummary] = useState<OwnerOfferSummary | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const isOwner = viewerId === ownerId;

  const text = {
    title: "Offers & Bids",
    ownerTitle: "Offers",
    highestOffer: "Highest Offer",
    noOffers: "None",
    bidCount: (count: number) => `${count} bids`,
    recentBids: "Recent Offers",
    amount: "Your bid",
    signIn: "Sign in to bid or send an offer",
    signInHint: "Your saved account phone number will be used automatically.",
    minBid: (amount: number) => `For a public bid, your amount must be higher than ${formatPrice(amount, locale)}.`,
    publicHint: "Public bids are visible to everyone and raise the current highest bid.",
    privateHint: "Private offers are shared only with the listing owner.",
    privateOnlyHint: "This seller accepts private offers only. Public bidding is off for this listing.",
    publicBid: "Public Bid",
    privateOffer: "Private Offer",
    publicBadge: "Public",
    privateBadge: "Private",
    warningTitle: "Important warning before bidding",
    warningBody: "If the listing owner reports this as a false bid and the purchase is not completed, your account will be blocked from bidding for one month. If it happens again, the account will be banned.",
    confirmBid: "Accept and Place Bid",
    cancelBid: "Cancel",
    confirmAmount: "Bid amount",
    confirmType: "Offer type",
    closedHint: "Bidding is closed for this listing after an offer was accepted.",
    ownerHint: "Public bids and private offers both appear here.",
    ownerNoOffers: "No offers to manage yet.",
    bidder: "Bidder",
    accept: "Accept Offer",
    accepting: "Accepting...",
    accepted: "Accepted",
    acceptedSummary: "An offer has been accepted for this listing.",
    unaccept: "Unaccept Offer",
    unaccepting: "Reopening...",
    unacceptedSuccess: "Offer acceptance removed and bidding reopened.",
    acceptedContactTitle: "Contact Accepted Bidder",
    bidderPhone: "Bidder phone",
    callBidder: "Call Bidder",
    whatsappBidder: "WhatsApp Bidder",
    submit: "Place Bid",
    submitting: "Sending...",
    loading: "Loading offers...",
    missingApi: "NEXT_PUBLIC_API_BASE is missing.",
    invalidAmount: "Enter a valid offer amount.",
    lowerThanHighest: (amount: number) => `Your bid must be higher than ${formatPrice(amount, locale)}.`,
    success: "Bid placed.",
    privateSuccess: "Private offer sent.",
    acceptedSuccess: "Offer accepted and bidding closed.",
    loginRequired: "You must sign in before placing a bid.",
    failed: "Failed to send offer.",
    acceptFailed: "Failed to accept offer.",
  };

  const currentSummary = isOwner && ownerSummary ? ownerSummary : summary;
  const acceptedOffer = currentSummary?.accepted_offer ?? null;
  const biddingOpen = currentSummary?.bidding_open ?? true;
  const publicBiddingEnabled = currentSummary?.public_bidding_enabled ?? publicBiddingEnabledProp;
  const minimumBid = publicBiddingEnabled ? (currentSummary?.highest_offer ?? 0) + 1 : 1;
  const acceptedOwnerOffer = isOwner && acceptedOffer && isOwnerOfferEntry(acceptedOffer) ? acceptedOffer : null;
  const acceptedBidderLabel = acceptedOwnerOffer?.buyer_user_label || acceptedOwnerOffer?.phone_e164 || null;
  const acceptedBidderPhone = acceptedOwnerOffer?.phone_e164 || null;
  const acceptedBidderWhatsapp = acceptedBidderPhone
    ? buildWhatsappUrl(
        acceptedBidderPhone,
        `Hello, regarding your accepted offer on listing #${carId}`,
      )
    : null;

  useEffect(() => {
    async function syncAuth() {
      const nextToken = window.localStorage.getItem(TOKEN_KEY) || "";
      setToken(nextToken);

      if (!API_BASE || !nextToken) {
        setViewerId(null);
        return;
      }

      try {
        const res = await fetch(`${API_BASE}/v1/me`, {
          headers: { Authorization: `Bearer ${nextToken}` },
          cache: "no-store",
        });
        if (!res.ok) {
          setViewerId(null);
          return;
        }
        const me = (await res.json()) as MeResponse;
        setViewerId(me.id);
      } catch {
        setViewerId(null);
      }
    }

    void syncAuth();
    window.addEventListener("autointel-auth-changed", syncAuth);
    window.addEventListener("focus", syncAuth);
    return () => {
      window.removeEventListener("autointel-auth-changed", syncAuth);
      window.removeEventListener("focus", syncAuth);
    };
  }, []);

  async function loadOffers() {
    if (!API_BASE) {
      setError(text.missingApi);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");
    try {
      const headers: HeadersInit = {};
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }
      const res = await fetch(`${API_BASE}/v1/cars/${carId}/offers`, {
        headers,
        cache: "no-store",
      });

      if (!res.ok) {
        const contentType = res.headers.get("content-type") || "";
        const payload = contentType.includes("application/json") ? await res.json() : await res.text();
        const detail = typeof payload === "string" ? payload : payload?.detail;
        throw new Error(translateApiMessage(locale, detail || text.failed));
      }

      const data = (await res.json()) as OfferSummary;
      setSummary(data);
    } catch (err) {
      setError(err instanceof Error ? translateApiMessage(locale, err.message) : text.failed);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadOffers();
  // carId/API_BASE are stable for this page lifecycle.
  }, [carId, token]);

  useEffect(() => {
    if (acceptedOffer) {
      setConfirmAmount(null);
      setConfirmVisibility(null);
    }
  }, [acceptedOffer]);

  useEffect(() => {
    async function loadOwnerOffers() {
      if (!API_BASE || !token || !isOwner) {
        setOwnerSummary(null);
        return;
      }

      try {
        const res = await fetch(`${API_BASE}/v1/cars/${carId}/offers/manage`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          cache: "no-store",
        });

        if (!res.ok) {
          const contentType = res.headers.get("content-type") || "";
          const payload = contentType.includes("application/json") ? await res.json() : await res.text();
          const detail = typeof payload === "string" ? payload : payload?.detail;
          throw new Error(translateApiMessage(locale, detail || text.failed));
        }

        const data = (await res.json()) as OwnerOfferSummary;
        setOwnerSummary(data);
      } catch (err) {
        setError(err instanceof Error ? translateApiMessage(locale, err.message) : text.failed);
      }
    }

    void loadOwnerOffers();
  }, [carId, isOwner, text.failed, token]);

  async function submitBid(nextAmount: number, nextVisibility: "public" | "private") {
    setError("");
    setSuccess("");

    if (!API_BASE) {
      setError(text.missingApi);
      return;
    }

    if (!Number.isFinite(nextAmount) || nextAmount <= 0) {
      setError(text.invalidAmount);
      return;
    }

    if (!token) {
      setError(text.loginRequired);
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/v1/cars/${carId}/offers`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          amount: Math.trunc(nextAmount),
          visibility: nextVisibility,
        }),
      });

      if (!res.ok) {
        const contentType = res.headers.get("content-type") || "";
        const payload = contentType.includes("application/json") ? await res.json() : await res.text();
        const detail = typeof payload === "string" ? payload : payload?.detail;
        throw new Error(translateApiMessage(locale, detail || text.failed));
      }

      setAmount("");
      setConfirmAmount(null);
      setConfirmVisibility(null);
      setSuccess(nextVisibility === "private" ? text.privateSuccess : text.success);
      void loadOffers();
      if (isOwner) {
        setOwnerSummary(null);
      }
    } catch (err) {
      setError(err instanceof Error ? translateApiMessage(locale, err.message) : text.failed);
    } finally {
      setSubmitting(false);
    }
  }

  function startOffer(nextVisibility: "public" | "private") {
    setError("");
    setSuccess("");

    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError(text.invalidAmount);
      return;
    }

    if (nextVisibility === "public" && parsedAmount < minimumBid) {
      setError(text.lowerThanHighest(minimumBid - 1));
      return;
    }
    if (nextVisibility === "public" && !publicBiddingEnabled) {
      setError(text.privateOnlyHint);
      return;
    }

    if (!token) {
      setError(text.loginRequired);
      return;
    }

    setConfirmAmount(Math.trunc(parsedAmount));
    setConfirmVisibility(nextVisibility);
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    startOffer("public");
  }

  async function handleAccept(offerId: number) {
    if (!API_BASE || !token) {
      setError(text.loginRequired);
      return;
    }

    setError("");
    setSuccess("");
    setAcceptingId(offerId);
    try {
      const res = await fetch(`${API_BASE}/v1/cars/${carId}/offers/${offerId}/accept`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const contentType = res.headers.get("content-type") || "";
        const payload = contentType.includes("application/json") ? await res.json() : await res.text();
        const detail = typeof payload === "string" ? payload : payload?.detail;
        throw new Error(translateApiMessage(locale, detail || text.acceptFailed));
      }

      setSuccess(text.acceptedSuccess);
      await Promise.all([loadOffers(), (async () => {
        const manageRes = await fetch(`${API_BASE}/v1/cars/${carId}/offers/manage`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          cache: "no-store",
        });
        if (manageRes.ok) {
          const data = (await manageRes.json()) as OwnerOfferSummary;
          setOwnerSummary(data);
        }
      })()]);
    } catch (err) {
      setError(err instanceof Error ? translateApiMessage(locale, err.message) : text.acceptFailed);
    } finally {
      setAcceptingId(null);
    }
  }

  async function handleUnaccept(offerId: number) {
    if (!API_BASE || !token) {
      setError(text.loginRequired);
      return;
    }

    setError("");
    setSuccess("");
    setUnacceptingId(offerId);
    try {
      const res = await fetch(`${API_BASE}/v1/cars/${carId}/offers/${offerId}/unaccept`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const contentType = res.headers.get("content-type") || "";
        const payload = contentType.includes("application/json") ? await res.json() : await res.text();
        const detail = typeof payload === "string" ? payload : payload?.detail;
        throw new Error(translateApiMessage(locale, detail || text.acceptFailed));
      }

      setSuccess(text.unacceptedSuccess);
      await Promise.all([loadOffers(), (async () => {
        const manageRes = await fetch(`${API_BASE}/v1/cars/${carId}/offers/manage`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          cache: "no-store",
        });
        if (manageRes.ok) {
          const data = (await manageRes.json()) as OwnerOfferSummary;
          setOwnerSummary(data);
        }
      })()]);
    } catch (err) {
      setError(err instanceof Error ? translateApiMessage(locale, err.message) : text.acceptFailed);
    } finally {
      setUnacceptingId(null);
    }
  }

  return (
    <section className="offer-panel">
      <h3 className="subheading">{isOwner ? text.ownerTitle : text.title}</h3>
      {publicBiddingEnabled && currentSummary?.offer_count ? (
        <div className="offer-summary spaced-top-sm">
          <p className="offer-summary-label">{text.highestOffer}</p>
          <p className="offer-summary-value">
            {currentSummary?.highest_offer ? formatPrice(currentSummary.highest_offer, locale) : text.noOffers}
          </p>
          <p className="offer-summary-count">{text.bidCount(currentSummary?.offer_count ?? 0)}</p>
        </div>
      ) : null}

      {acceptedOffer ? (
        <p className="notice success spaced-top-sm">
          {text.acceptedSummary} {formatPrice(acceptedOffer.amount, locale)}
        </p>
      ) : null}

      {acceptedOwnerOffer ? (
        <div className="offer-contact-card spaced-top-sm">
          <p className="offer-list-title">{text.acceptedContactTitle}</p>
          {acceptedBidderLabel ? <p className="car-meta">{acceptedBidderLabel}</p> : null}
          {acceptedBidderPhone ? (
            <>
              <p className="car-meta">{text.bidderPhone}: {acceptedBidderPhone}</p>
              <div className="contact-actions">
                <a href={`tel:${acceptedBidderPhone}`} className="btn btn-secondary">
                  {text.callBidder}
                </a>
                {acceptedBidderWhatsapp ? (
                  <a href={acceptedBidderWhatsapp} target="_blank" rel="noreferrer" className="btn btn-secondary">
                    {text.whatsappBidder}
                  </a>
                ) : null}
              </div>
            </>
          ) : null}
          <div className="contact-actions">
            <button
              type="button"
              className="btn btn-secondary"
              disabled={unacceptingId === acceptedOwnerOffer.id}
              onClick={() => void handleUnaccept(acceptedOwnerOffer.id)}
            >
              {unacceptingId === acceptedOwnerOffer.id ? text.unaccepting : text.unaccept}
            </button>
          </div>
        </div>
      ) : null}

      {loading ? (
        <p className="helper-text spaced-top-sm">{text.loading}</p>
      ) : currentSummary?.offers.length ? (
        <div className="offer-list spaced-top-sm">
          <p className="offer-list-title">{isOwner ? text.ownerHint : text.recentBids}</p>
          {currentSummary.offers.map((offer) => (
            <div key={offer.id} className="offer-list-item">
              <div className="offer-list-body">
                <strong>{formatPrice(offer.amount, locale)}</strong>
                {offer.visibility === "private" ? <span>{text.privateBadge}</span> : null}
                {isOwner && isOwnerOfferEntry(offer) ? (
                  <span>{text.bidder}: {offer.buyer_user_label || offer.phone_e164 || `#${offer.buyer_user_id ?? offer.id}`}</span>
                ) : null}
              </div>
              <div className="offer-list-side">
                <span className="offer-list-meta">{formatDateTime(offer.created_at, locale)}</span>
                {isOwner ? (
                  offer.accepted_at ? (
                    <span className="offer-list-badge">{text.accepted}</span>
                  ) : biddingOpen ? (
                    <button
                      type="button"
                      className="btn btn-secondary offer-list-action"
                      disabled={acceptingId === offer.id}
                      onClick={() => void handleAccept(offer.id)}
                    >
                      {acceptingId === offer.id ? text.accepting : text.accept}
                    </button>
                  ) : null
                ) : null}
              </div>
            </div>
          ))}
        </div>
      ) : isOwner ? (
        <p className="helper-text spaced-top-sm">{text.ownerNoOffers}</p>
      ) : null}

      {isOwner ? null : !biddingOpen ? (
        <p className="helper-text spaced-top-sm">{text.closedHint}</p>
      ) : token ? (
        <form className="filters spaced-top-sm" onSubmit={handleSubmit}>
          <div>
            <label className="label" htmlFor={`offer-amount-${carId}`}>{text.amount}</label>
            <input
              id={`offer-amount-${carId}`}
              className="input"
              type="number"
              min={minimumBid}
              inputMode="numeric"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>

          <p className="helper-text">
            {publicBiddingEnabled ? text.minBid(minimumBid - 1) : text.privateOnlyHint}
          </p>

          <div className="contact-actions">
            <button type="button" className="btn btn-secondary" disabled={submitting} onClick={() => startOffer("private")}>
              {submitting && confirmVisibility === "private" ? text.submitting : text.privateOffer}
            </button>
            {publicBiddingEnabled ? (
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting && confirmVisibility === "public" ? text.submitting : text.publicBid}
              </button>
            ) : null}
          </div>

          {error ? <p className="notice error">{error}</p> : null}
          {success ? <p className="notice success">{success}</p> : null}
        </form>
      ) : (
        <div className="filters spaced-top-sm">
          <Link href="/login" className="btn btn-primary">
            {text.signIn}
          </Link>
          {error ? <p className="notice error">{error}</p> : null}
        </div>
      )}

      {confirmAmount !== null ? (
        <div className="photo-viewer" role="dialog" aria-modal="true" aria-label={text.warningTitle}>
          <button
            type="button"
            className="photo-viewer-backdrop"
            onClick={() => {
              if (!submitting) {
                setConfirmAmount(null);
              }
            }}
            aria-label={text.cancelBid}
          />
          <div className="photo-viewer-card offer-confirm-card">
            <h4 className="offer-confirm-title">{text.warningTitle}</h4>
            <p className="offer-confirm-amount">
              {text.confirmAmount}: {formatPrice(confirmAmount, locale)}
            </p>
            <p className="offer-confirm-copy">
              {text.confirmType}: {confirmVisibility === "private" ? text.privateOffer : text.publicBid}
            </p>
            <p className="offer-confirm-copy">{text.warningBody}</p>
            <div className="offer-confirm-actions">
              <button
                type="button"
                className="btn btn-secondary"
                disabled={submitting}
                onClick={() => setConfirmAmount(null)}
              >
                {text.cancelBid}
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={submitting}
                onClick={() => {
                  if (confirmVisibility) {
                    void submitBid(confirmAmount, confirmVisibility);
                  }
                }}
              >
                {submitting ? text.submitting : text.confirmBid}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
