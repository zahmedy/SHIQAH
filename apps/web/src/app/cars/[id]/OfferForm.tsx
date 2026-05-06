"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";

import { useLocale } from "@/components/LocaleProvider";
import { formatDateTime, formatPrice, translateApiMessage } from "@/lib/locale";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE;
const TOKEN_KEY = "nicherides_access_token";
const FALSE_BID_REASONS = [
  ["fake_bid", "Fake bid"],
  ["no_show", "No-show after accepted offer"],
  ["spam", "Spam"],
  ["could_not_contact", "Could not contact bidder"],
  ["payment_issue", "Payment issue"],
  ["other", "Other"],
] as const;

type OfferEntry = {
  id: number;
  amount: number;
  created_at: string;
  accepted_at: string | null;
  rejected_at: string | null;
  expires_at: string | null;
  is_counteroffer: boolean;
};

type OfferSummary = {
  list_price: number | null;
  offer_count: number;
  offers_open: boolean;
  accepted_offer: OfferEntry | null;
  offers: OfferEntry[];
};

type OwnerOfferEntry = OfferEntry & {
  buyer_user_id: number | null;
  buyer_user_label: string | null;
  buyer_email: string | null;
  phone_e164: string | null;
  buyer_contact_text_enabled: boolean;
  buyer_contact_whatsapp_enabled: boolean;
  false_bid_report_count: number;
};

type OwnerOfferSummary = {
  list_price: number | null;
  offer_count: number;
  offers_open: boolean;
  accepted_offer: OwnerOfferEntry | null;
  offers: OwnerOfferEntry[];
};

type MeResponse = {
  id: number;
};

function isOwnerOfferEntry(offer: OfferEntry | OwnerOfferEntry): offer is OwnerOfferEntry {
  return "phone_e164" in offer;
}

function parseApiErrorPayload(payload: unknown, fallback: string, locale: ReturnType<typeof useLocale>) {
  const detail = typeof payload === "string" ? payload : (payload as { detail?: string })?.detail;
  return translateApiMessage(locale, detail || fallback);
}

function buildWhatsappUrl(phone: string, message: string) {
  return `https://wa.me/${phone.replace("+", "")}?text=${encodeURIComponent(message)}`;
}

function buildSmsUrl(phone: string, message: string) {
  return `sms:${phone}?&body=${encodeURIComponent(message)}`;
}

function buildEmailUrl(email: string, subject: string, message: string) {
  return `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`;
}

export default function OfferForm({
  carId,
  ownerId,
}: {
  carId: number;
  ownerId: number;
  publicBiddingEnabled?: boolean;
}) {
  const locale = useLocale();
  const [amount, setAmount] = useState("");
  const [counterAmount, setCounterAmount] = useState("");
  const [token, setToken] = useState("");
  const [viewerId, setViewerId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [acceptingId, setAcceptingId] = useState<number | null>(null);
  const [rejectingId, setRejectingId] = useState<number | null>(null);
  const [unacceptingId, setUnacceptingId] = useState<number | null>(null);
  const [counteringId, setCounteringId] = useState<number | null>(null);
  const [reportingId, setReportingId] = useState<number | null>(null);
  const [counterOffer, setCounterOffer] = useState<OwnerOfferEntry | null>(null);
  const [reportOffer, setReportOffer] = useState<OwnerOfferEntry | null>(null);
  const [reportReason, setReportReason] = useState("fake_bid");
  const [reportNotes, setReportNotes] = useState("");
  const [confirmAmount, setConfirmAmount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<OfferSummary | null>(null);
  const [ownerSummary, setOwnerSummary] = useState<OwnerOfferSummary | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const isOwner = viewerId === ownerId;

  const text = {
    title: "Make Offer",
    ownerTitle: "Offers",
    listPrice: "List Price",
    noPrice: "Ask seller",
    offerCount: (count: number) => `${count} active offer${count === 1 ? "" : "s"}`,
    recentOffers: "Your Offer",
    amount: "Offer amount",
    signIn: "Sign in to make an offer",
    offerHelp: "Offers are private and expire after 7 days.",
    disclaimer: "NicheRides is not the seller, dealer, broker, or escrow provider. Buyers and sellers are responsible for inspection, payment, title transfer, taxes, registration, and any escrow or shipping arrangements.",
    warningTitle: "Before making an offer",
    warningBody: "This offer is between you and the seller. NicheRides does not hold funds, verify payment, broker the sale, or provide escrow.",
    confirmOffer: "Make Offer",
    cancel: "Cancel",
    confirmAmount: "Offer amount",
    closedHint: "Offers are closed after an offer is accepted.",
    ownerHint: "Offers are private. Active offers and counteroffers expire after 7 days.",
    ownerNoOffers: "No active offers to manage yet.",
    bidder: "Buyer",
    accept: "Accept Offer",
    acceptCounter: "Accept Counteroffer",
    accepting: "Accepting...",
    reject: "Reject",
    rejecting: "Rejecting...",
    counter: "Counteroffer",
    countering: "Sending...",
    counterTitle: "Send Counteroffer",
    counterAmount: "Counteroffer amount",
    counterSuccess: "Counteroffer sent.",
    counterFailed: "Failed to send counteroffer.",
    counterBadge: "Counteroffer",
    expires: (value: string) => `Expires ${value}`,
    reportFalseBid: "Flag false bid",
    reportingFalseBid: "Flagging...",
    reportFalseBidTitle: "Flag false bid",
    reportFalseBidHelp: "Only accepted offers can be flagged. Reports go to admins for review before any buyer action is taken.",
    flaggedFalseBid: "Flagged for admin review",
    reportReason: "Reason",
    reportNotes: "Notes optional",
    reportSubmitted: "False bid report submitted for admin review.",
    reportFailed: "Failed to submit report.",
    reportAcceptedOnly: "Only an accepted offer can be flagged.",
    accepted: "Accepted",
    acceptedSummary: "An offer has been accepted for this listing.",
    unaccept: "Reopen Offers",
    unaccepting: "Reopening...",
    unacceptedSuccess: "Offer acceptance removed and offers reopened.",
    acceptedContactTitle: "Contact Accepted Buyer",
    buyerPhone: "Buyer phone",
    emailBuyer: "Email Buyer",
    textBuyer: "Text Buyer",
    callBuyer: "Call Buyer",
    whatsappBuyer: "WhatsApp Buyer",
    submitting: "Sending...",
    loading: "Loading offers...",
    missingApi: "NEXT_PUBLIC_API_BASE is missing.",
    invalidAmount: "Enter a valid offer amount.",
    success: "Offer sent.",
    acceptedSuccess: "Offer accepted and offers closed.",
    counterAcceptedSuccess: "Counteroffer accepted and offers closed.",
    rejectedSuccess: "Offer rejected.",
    loginRequired: "You must sign in before making an offer.",
    failed: "Failed to send offer.",
    acceptFailed: "Failed to accept offer.",
    rejectFailed: "Failed to reject offer.",
  };

  const currentSummary = isOwner && ownerSummary ? ownerSummary : summary;
  const acceptedOffer = currentSummary?.accepted_offer ?? null;
  const offersOpen = currentSummary?.offers_open ?? true;
  const acceptedOwnerOffer = isOwner && acceptedOffer && isOwnerOfferEntry(acceptedOffer) ? acceptedOffer : null;
  const acceptedBuyerLabel = acceptedOwnerOffer?.buyer_user_label || acceptedOwnerOffer?.buyer_email || acceptedOwnerOffer?.phone_e164 || null;
  const acceptedBuyerPhone = acceptedOwnerOffer?.phone_e164 || null;
  const acceptedBuyerMessage = `Hello, regarding your accepted offer on listing #${carId}`;
  const acceptedBuyerEmail = acceptedOwnerOffer?.buyer_email
    ? buildEmailUrl(acceptedOwnerOffer.buyer_email, `Accepted offer on listing #${carId}`, acceptedBuyerMessage)
    : null;
  const acceptedBuyerSms = acceptedBuyerPhone && acceptedOwnerOffer?.buyer_contact_text_enabled
    ? buildSmsUrl(acceptedBuyerPhone, acceptedBuyerMessage)
    : null;
  const acceptedBuyerWhatsapp = acceptedBuyerPhone && acceptedOwnerOffer?.buyer_contact_whatsapp_enabled
    ? buildWhatsappUrl(acceptedBuyerPhone, acceptedBuyerMessage)
    : null;

  async function parseApiError(res: Response, fallback: string) {
    const contentType = res.headers.get("content-type") || "";
    const payload = contentType.includes("application/json") ? await res.json() : await res.text();
    return parseApiErrorPayload(payload, fallback, locale);
  }

  async function reloadOwnerOffers() {
    if (!API_BASE || !token || !isOwner) return;
    const manageRes = await fetch(`${API_BASE}/v1/cars/${carId}/offers/manage`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (manageRes.ok) {
      setOwnerSummary((await manageRes.json()) as OwnerOfferSummary);
    }
  }

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
      if (token) headers.Authorization = `Bearer ${token}`;
      const res = await fetch(`${API_BASE}/v1/cars/${carId}/offers`, { headers, cache: "no-store" });
      if (!res.ok) throw new Error(await parseApiError(res, text.failed));
      setSummary((await res.json()) as OfferSummary);
    } catch (err) {
      setError(err instanceof Error ? translateApiMessage(locale, err.message) : text.failed);
    } finally {
      setLoading(false);
    }
  }

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
    window.addEventListener("nicherides-auth-changed", syncAuth);
    window.addEventListener("focus", syncAuth);
    return () => {
      window.removeEventListener("nicherides-auth-changed", syncAuth);
      window.removeEventListener("focus", syncAuth);
    };
  }, []);

  useEffect(() => {
    void loadOffers();
  // carId/API_BASE are stable for this page lifecycle.
  }, [carId, token]);

  useEffect(() => {
    if (acceptedOffer) {
      setConfirmAmount(null);
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
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        if (!res.ok) throw new Error(await parseApiError(res, text.failed));
        setOwnerSummary((await res.json()) as OwnerOfferSummary);
      } catch (err) {
        setError(err instanceof Error ? translateApiMessage(locale, err.message) : text.failed);
      }
    }

    void loadOwnerOffers();
  }, [carId, isOwner, text.failed, token]);

  async function submitOffer(nextAmount: number) {
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
        body: JSON.stringify({ amount: Math.trunc(nextAmount) }),
      });

      if (!res.ok) throw new Error(await parseApiError(res, text.failed));

      setAmount("");
      setConfirmAmount(null);
      setSuccess(text.success);
      void loadOffers();
      if (isOwner) setOwnerSummary(null);
    } catch (err) {
      setError(err instanceof Error ? translateApiMessage(locale, err.message) : text.failed);
    } finally {
      setSubmitting(false);
    }
  }

  function startOffer() {
    setError("");
    setSuccess("");

    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError(text.invalidAmount);
      return;
    }
    if (!token) {
      setError(text.loginRequired);
      return;
    }

    setConfirmAmount(Math.trunc(parsedAmount));
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    startOffer();
  }

  async function handleAccept(offerId: number, isCounteroffer = false) {
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
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(await parseApiError(res, text.acceptFailed));

      setSuccess(isCounteroffer ? text.counterAcceptedSuccess : text.acceptedSuccess);
      await Promise.all([loadOffers(), reloadOwnerOffers()]);
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
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(await parseApiError(res, text.acceptFailed));

      setSuccess(text.unacceptedSuccess);
      await Promise.all([loadOffers(), reloadOwnerOffers()]);
    } catch (err) {
      setError(err instanceof Error ? translateApiMessage(locale, err.message) : text.acceptFailed);
    } finally {
      setUnacceptingId(null);
    }
  }

  async function handleReject(offerId: number) {
    if (!API_BASE || !token) {
      setError(text.loginRequired);
      return;
    }

    setError("");
    setSuccess("");
    setRejectingId(offerId);
    try {
      const res = await fetch(`${API_BASE}/v1/cars/${carId}/offers/${offerId}/reject`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(await parseApiError(res, text.rejectFailed));

      setSuccess(text.rejectedSuccess);
      await Promise.all([loadOffers(), reloadOwnerOffers()]);
    } catch (err) {
      setError(err instanceof Error ? translateApiMessage(locale, err.message) : text.rejectFailed);
    } finally {
      setRejectingId(null);
    }
  }

  async function handleCounterOffer(event: FormEvent) {
    event.preventDefault();
    if (!counterOffer) return;
    if (!API_BASE || !token) {
      setError(text.loginRequired);
      return;
    }

    const parsedAmount = Number(counterAmount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError(text.invalidAmount);
      return;
    }

    setError("");
    setSuccess("");
    setCounteringId(counterOffer.id);
    try {
      const res = await fetch(`${API_BASE}/v1/cars/${carId}/offers/${counterOffer.id}/counter`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ amount: Math.trunc(parsedAmount) }),
      });
      if (!res.ok) throw new Error(await parseApiError(res, text.counterFailed));

      setSuccess(text.counterSuccess);
      setCounterOffer(null);
      setCounterAmount("");
      await Promise.all([loadOffers(), reloadOwnerOffers()]);
    } catch (err) {
      setError(err instanceof Error ? translateApiMessage(locale, err.message) : text.counterFailed);
    } finally {
      setCounteringId(null);
    }
  }

  async function handleFalseBidReport(event: FormEvent) {
    event.preventDefault();
    if (!reportOffer) return;
    if (!reportOffer.accepted_at) {
      setError(text.reportAcceptedOnly);
      setReportOffer(null);
      return;
    }
    if (!API_BASE || !token) {
      setError(text.loginRequired);
      return;
    }

    setError("");
    setSuccess("");
    setReportingId(reportOffer.id);
    try {
      const res = await fetch(`${API_BASE}/v1/cars/${carId}/offers/${reportOffer.id}/reports`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          reason: reportReason,
          notes: reportNotes.trim() || undefined,
        }),
      });
      if (!res.ok) throw new Error(await parseApiError(res, text.reportFailed));

      setSuccess(text.reportSubmitted);
      setOwnerSummary((current) => {
        if (!current) return current;
        const markFlagged = (offer: OwnerOfferEntry) => (
          offer.id === reportOffer.id
            ? { ...offer, false_bid_report_count: Math.max(1, offer.false_bid_report_count || 0) }
            : offer
        );
        return {
          ...current,
          accepted_offer: current.accepted_offer ? markFlagged(current.accepted_offer) : null,
          offers: current.offers.map(markFlagged),
        };
      });
      setReportOffer(null);
      setReportReason("fake_bid");
      setReportNotes("");
    } catch (err) {
      setError(err instanceof Error ? translateApiMessage(locale, err.message) : text.reportFailed);
    } finally {
      setReportingId(null);
    }
  }

  return (
    <section className="offer-panel">
      <h3 className="subheading">{isOwner ? text.ownerTitle : text.title}</h3>
      <div className="offer-summary spaced-top-sm">
        <p className="offer-summary-label">{text.listPrice}</p>
        <p className="offer-summary-value">
          {currentSummary?.list_price ? formatPrice(currentSummary.list_price, locale) : text.noPrice}
        </p>
        <p className="offer-summary-count">{text.offerCount(currentSummary?.offer_count ?? 0)}</p>
      </div>
      <p className="helper-text spaced-top-sm">{text.offerHelp}</p>
      <p className="notice spaced-top-sm">{text.disclaimer}</p>

      {acceptedOffer ? (
        <p className="notice success spaced-top-sm">
          {text.acceptedSummary} {formatPrice(acceptedOffer.amount, locale)}
        </p>
      ) : null}

      {acceptedOwnerOffer ? (
        <div className="offer-contact-card spaced-top-sm">
          <p className="offer-list-title">{text.acceptedContactTitle}</p>
          {acceptedBuyerLabel ? <p className="car-meta">{acceptedBuyerLabel}</p> : null}
          {acceptedOwnerOffer.false_bid_report_count > 0 ? (
            <p className="offer-list-badge">{text.flaggedFalseBid}</p>
          ) : null}
          {acceptedBuyerPhone ? (
            <>
              <p className="car-meta">{text.buyerPhone}: {acceptedBuyerPhone}</p>
              <div className="contact-actions">
                {acceptedBuyerEmail ? <a href={acceptedBuyerEmail} className="btn btn-secondary">{text.emailBuyer}</a> : null}
                {acceptedBuyerSms ? <a href={acceptedBuyerSms} className="btn btn-secondary">{text.textBuyer}</a> : null}
                <a href={`tel:${acceptedBuyerPhone}`} className="btn btn-secondary">{text.callBuyer}</a>
                {acceptedBuyerWhatsapp ? (
                  <a href={acceptedBuyerWhatsapp} target="_blank" rel="noreferrer" className="btn btn-secondary">
                    {text.whatsappBuyer}
                  </a>
                ) : null}
              </div>
            </>
          ) : acceptedBuyerEmail ? (
            <div className="contact-actions">
              <a href={acceptedBuyerEmail} className="btn btn-secondary">{text.emailBuyer}</a>
            </div>
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
            <button
              type="button"
              className="btn btn-secondary"
              disabled={reportingId === acceptedOwnerOffer.id || acceptedOwnerOffer.false_bid_report_count > 0}
              onClick={() => {
                setReportOffer(acceptedOwnerOffer);
                setError("");
                setSuccess("");
              }}
            >
              {acceptedOwnerOffer.false_bid_report_count > 0 ? text.flaggedFalseBid : reportingId === acceptedOwnerOffer.id ? text.reportingFalseBid : text.reportFalseBid}
            </button>
          </div>
        </div>
      ) : null}

      {loading ? (
        <p className="helper-text spaced-top-sm">{text.loading}</p>
      ) : currentSummary?.offers.length ? (
        <div className="offer-list spaced-top-sm">
          <p className="offer-list-title">{isOwner ? text.ownerHint : text.recentOffers}</p>
          {currentSummary.offers.map((offer) => (
            <div key={offer.id} className="offer-list-item">
              <div className="offer-list-body">
                <strong>{formatPrice(offer.amount, locale)}</strong>
                {offer.is_counteroffer ? <span>{text.counterBadge}</span> : null}
                {offer.expires_at ? <span>{text.expires(formatDateTime(offer.expires_at, locale))}</span> : null}
                {isOwnerOfferEntry(offer) && offer.false_bid_report_count > 0 ? <span>{text.flaggedFalseBid}</span> : null}
                {isOwner && isOwnerOfferEntry(offer) ? (
                  <span>{text.bidder}: {offer.buyer_user_label || offer.phone_e164 || `#${offer.buyer_user_id ?? offer.id}`}</span>
                ) : null}
              </div>
              <div className="offer-list-side">
                <span className="offer-list-meta">{formatDateTime(offer.created_at, locale)}</span>
                {isOwner && isOwnerOfferEntry(offer) ? (
                  offer.accepted_at ? (
                    <span className="offer-list-badge">{text.accepted}</span>
                  ) : offersOpen ? (
                    <>
                      {offer.is_counteroffer ? null : (
                        <>
                          <button
                            type="button"
                            className="btn btn-secondary offer-list-action"
                            disabled={acceptingId === offer.id || rejectingId === offer.id || counteringId === offer.id}
                            onClick={() => void handleAccept(offer.id)}
                          >
                            {acceptingId === offer.id ? text.accepting : text.accept}
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary offer-list-action"
                            disabled={acceptingId === offer.id || rejectingId === offer.id || counteringId === offer.id}
                            onClick={() => {
                              setCounterOffer(offer);
                              setCounterAmount("");
                              setError("");
                              setSuccess("");
                            }}
                          >
                            {counteringId === offer.id ? text.countering : text.counter}
                          </button>
                        </>
                      )}
                      <button
                        type="button"
                        className="btn btn-danger offer-list-action"
                        disabled={acceptingId === offer.id || rejectingId === offer.id || counteringId === offer.id}
                        onClick={() => void handleReject(offer.id)}
                      >
                        {rejectingId === offer.id ? text.rejecting : text.reject}
                      </button>
                    </>
                  ) : null
                ) : !isOwner && offer.is_counteroffer && !offer.accepted_at && offersOpen ? (
                  <button
                    type="button"
                    className="btn btn-secondary offer-list-action"
                    disabled={acceptingId === offer.id}
                    onClick={() => void handleAccept(offer.id, true)}
                  >
                    {acceptingId === offer.id ? text.accepting : text.acceptCounter}
                  </button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      ) : isOwner ? (
        <p className="helper-text spaced-top-sm">{text.ownerNoOffers}</p>
      ) : null}

      {isOwner ? null : !offersOpen ? (
        <p className="helper-text spaced-top-sm">{text.closedHint}</p>
      ) : token ? (
        <form className="filters spaced-top-sm" onSubmit={handleSubmit}>
          <div>
            <label className="label" htmlFor={`offer-amount-${carId}`}>{text.amount}</label>
            <input
              id={`offer-amount-${carId}`}
              className="input"
              type="number"
              min={1}
              inputMode="numeric"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div className="contact-actions">
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? text.submitting : text.confirmOffer}
            </button>
          </div>
          {error ? <p className="notice error">{error}</p> : null}
          {success ? <p className="notice success">{success}</p> : null}
        </form>
      ) : (
        <div className="filters spaced-top-sm">
          <Link href="/login" className="btn btn-primary">{text.signIn}</Link>
          {error ? <p className="notice error">{error}</p> : null}
        </div>
      )}

      {confirmAmount !== null ? (
        <div className="photo-viewer" role="dialog" aria-modal="true" aria-label={text.warningTitle}>
          <button
            type="button"
            className="photo-viewer-backdrop"
            onClick={() => {
              if (!submitting) setConfirmAmount(null);
            }}
            aria-label={text.cancel}
          />
          <div className="photo-viewer-card offer-confirm-card">
            <h4 className="offer-confirm-title">{text.warningTitle}</h4>
            <p className="offer-confirm-amount">{text.confirmAmount}: {formatPrice(confirmAmount, locale)}</p>
            <p className="offer-confirm-copy">{text.warningBody}</p>
            <div className="offer-confirm-actions">
              <button type="button" className="btn btn-secondary" disabled={submitting} onClick={() => setConfirmAmount(null)}>
                {text.cancel}
              </button>
              <button type="button" className="btn btn-primary" disabled={submitting} onClick={() => void submitOffer(confirmAmount)}>
                {submitting ? text.submitting : text.confirmOffer}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {counterOffer ? (
        <div className="photo-viewer" role="dialog" aria-modal="true" aria-label={text.counterTitle}>
          <button
            type="button"
            className="photo-viewer-backdrop"
            aria-label={text.cancel}
            onClick={() => {
              if (counteringId === null) setCounterOffer(null);
            }}
          />
          <form className="photo-viewer-card offer-confirm-card" onSubmit={handleCounterOffer}>
            <h4 className="offer-confirm-title">{text.counterTitle}</h4>
            <p className="offer-confirm-copy">
              Current offer: {formatPrice(counterOffer.amount, locale)} · {counterOffer.buyer_user_label || counterOffer.phone_e164 || `#${counterOffer.buyer_user_id ?? counterOffer.id}`}
            </p>
            <label className="label" htmlFor={`counter-offer-${counterOffer.id}`}>{text.counterAmount}</label>
            <input
              id={`counter-offer-${counterOffer.id}`}
              className="input"
              type="number"
              min={1}
              inputMode="numeric"
              value={counterAmount}
              onChange={(event) => setCounterAmount(event.target.value)}
              disabled={counteringId !== null}
            />
            <div className="offer-confirm-actions">
              <button type="button" className="btn btn-secondary" disabled={counteringId !== null} onClick={() => setCounterOffer(null)}>
                {text.cancel}
              </button>
              <button type="submit" className="btn btn-primary" disabled={counteringId !== null}>
                {counteringId !== null ? text.countering : text.counter}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {reportOffer ? (
        <div className="photo-viewer" role="dialog" aria-modal="true" aria-label={text.reportFalseBidTitle}>
          <button
            type="button"
            className="photo-viewer-backdrop"
            aria-label={text.cancel}
            onClick={() => {
              if (reportingId === null) setReportOffer(null);
            }}
          />
          <form className="photo-viewer-card offer-confirm-card" onSubmit={handleFalseBidReport}>
            <h4 className="offer-confirm-title">{text.reportFalseBidTitle}</h4>
            <p className="offer-confirm-copy">
              {formatPrice(reportOffer.amount, locale)} · {reportOffer.buyer_user_label || reportOffer.phone_e164 || `#${reportOffer.buyer_user_id ?? reportOffer.id}`}
            </p>
            <p className="offer-confirm-copy">{text.reportFalseBidHelp}</p>
            <label className="label" htmlFor={`false-bid-reason-${reportOffer.id}`}>{text.reportReason}</label>
            <select
              id={`false-bid-reason-${reportOffer.id}`}
              className="select"
              value={reportReason}
              onChange={(event) => setReportReason(event.target.value)}
              disabled={reportingId !== null}
            >
              {FALSE_BID_REASONS.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            <label className="label spaced-top-sm" htmlFor={`false-bid-notes-${reportOffer.id}`}>{text.reportNotes}</label>
            <textarea
              id={`false-bid-notes-${reportOffer.id}`}
              className="textarea"
              rows={4}
              value={reportNotes}
              onChange={(event) => setReportNotes(event.target.value)}
              disabled={reportingId !== null}
              placeholder="Add contact attempts, no-show details, or other context."
            />
            <div className="offer-confirm-actions">
              <button type="button" className="btn btn-secondary" disabled={reportingId !== null} onClick={() => setReportOffer(null)}>
                {text.cancel}
              </button>
              <button type="submit" className="btn btn-primary" disabled={reportingId !== null}>
                {reportingId !== null ? text.reportingFalseBid : text.reportFalseBid}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </section>
  );
}
