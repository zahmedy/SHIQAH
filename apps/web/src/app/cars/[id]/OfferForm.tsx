"use client";

import { FormEvent, useEffect, useState } from "react";

import { useLocale } from "@/components/LocaleProvider";
import { formatDateTime, formatPrice } from "@/lib/locale";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE;

type OfferEntry = {
  id: number;
  amount_sar: number;
  created_at: string;
};

type OfferSummary = {
  highest_offer_sar: number | null;
  offer_count: number;
  offers: OfferEntry[];
};

function looksLikeE164(phone: string): boolean {
  return /^\+\d{8,15}$/.test(phone.trim());
}

export default function OfferForm({ carId }: { carId: number }) {
  const locale = useLocale();
  const isArabic = locale === "ar";
  const [amount, setAmount] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<OfferSummary | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const text = isArabic
    ? {
        title: "المزايدة",
        highestOffer: "أعلى عرض",
        noOffers: "لا توجد عروض بعد",
        bidCount: (count: number) => `${count} عرض`,
        recentBids: "أحدث العروض",
        amount: "قيمة العرض",
        phone: "الهاتف للتواصل",
        phoneHint: "اختياري، بصيغة +9665XXXXXXX",
        note: "ملاحظة",
        notePlaceholder: "رسالة قصيرة للبائع",
        submit: "قدّم عرضك",
        submitting: "جارٍ الإرسال...",
        loading: "جارٍ تحميل العروض...",
        missingApi: "متغير NEXT_PUBLIC_API_BASE غير موجود.",
        invalidAmount: "أدخل قيمة عرض صحيحة.",
        invalidPhone: "أدخل الهاتف بصيغة صحيحة مثل +9665XXXXXXX.",
        success: "تم تسجيل العرض.",
        failed: "تعذر إرسال العرض.",
      }
    : {
        title: "Bidding",
        highestOffer: "Highest Offer",
        noOffers: "No offers yet",
        bidCount: (count: number) => `${count} bids`,
        recentBids: "Recent Offers",
        amount: "Your bid",
        phone: "Contact phone",
        phoneHint: "Optional, in +9665XXXXXXX format",
        note: "Note",
        notePlaceholder: "Short message to the seller",
        submit: "Place Bid",
        submitting: "Sending...",
        loading: "Loading offers...",
        missingApi: "NEXT_PUBLIC_API_BASE is missing.",
        invalidAmount: "Enter a valid offer amount.",
        invalidPhone: "Enter phone in a valid format like +9665XXXXXXX.",
        success: "Bid placed.",
        failed: "Failed to send offer.",
      };

  async function loadOffers() {
    if (!API_BASE) {
      setError(text.missingApi);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/v1/cars/${carId}/offers`, {
        cache: "no-store",
      });

      if (!res.ok) {
        const contentType = res.headers.get("content-type") || "";
        const payload = contentType.includes("application/json") ? await res.json() : await res.text();
        const detail = typeof payload === "string" ? payload : payload?.detail;
        throw new Error(detail || text.failed);
      }

      const data = (await res.json()) as OfferSummary;
      setSummary(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : text.failed);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadOffers();
  // carId/API_BASE are stable for this page lifecycle.
  }, [carId]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!API_BASE) {
      setError(text.missingApi);
      return;
    }

    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError(text.invalidAmount);
      return;
    }

    if (phone.trim() && !looksLikeE164(phone)) {
      setError(text.invalidPhone);
      return;
    }

    setSubmitting(true);
    try {
      const message = [
        isArabic ? `عرض: ${Math.trunc(parsedAmount)} ر.س` : `Offer: ${Math.trunc(parsedAmount)} SAR`,
        note.trim(),
      ].filter(Boolean).join("\n");

      const res = await fetch(`${API_BASE}/v1/cars/${carId}/offers`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount_sar: Math.trunc(parsedAmount),
          phone_e164: phone.trim() || undefined,
          message,
        }),
      });

      if (!res.ok) {
        const contentType = res.headers.get("content-type") || "";
        const payload = contentType.includes("application/json") ? await res.json() : await res.text();
        const detail = typeof payload === "string" ? payload : payload?.detail;
        throw new Error(detail || text.failed);
      }

      setAmount("");
      setPhone("");
      setNote("");
      setSuccess(text.success);
      void loadOffers();
    } catch (err) {
      setError(err instanceof Error ? err.message : text.failed);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="offer-panel">
      <h3 className="subheading">{text.title}</h3>
      <div className="offer-summary spaced-top-sm">
        <p className="offer-summary-label">{text.highestOffer}</p>
        <p className="offer-summary-value">
          {summary?.highest_offer_sar ? formatPrice(summary.highest_offer_sar, locale) : text.noOffers}
        </p>
        <p className="offer-summary-count">{text.bidCount(summary?.offer_count ?? 0)}</p>
      </div>

      {loading ? (
        <p className="helper-text spaced-top-sm">{text.loading}</p>
      ) : summary?.offers.length ? (
        <div className="offer-list spaced-top-sm">
          <p className="offer-list-title">{text.recentBids}</p>
          {summary.offers.map((offer) => (
            <div key={offer.id} className="offer-list-item">
              <strong>{formatPrice(offer.amount_sar, locale)}</strong>
              <span>{formatDateTime(offer.created_at, locale)}</span>
            </div>
          ))}
        </div>
      ) : null}

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

        <div>
          <label className="label" htmlFor={`offer-phone-${carId}`}>{text.phone}</label>
          <input
            id={`offer-phone-${carId}`}
            className="input"
            placeholder="+9665XXXXXXX"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <p className="helper-text">{text.phoneHint}</p>
        </div>

        <div>
          <label className="label" htmlFor={`offer-note-${carId}`}>{text.note}</label>
          <textarea
            id={`offer-note-${carId}`}
            className="textarea"
            rows={3}
            placeholder={text.notePlaceholder}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>

        <button type="submit" className="btn btn-primary" disabled={submitting}>
          {submitting ? text.submitting : text.submit}
        </button>

        {error ? <p className="notice error">{error}</p> : null}
        {success ? <p className="notice success">{success}</p> : null}
      </form>
    </section>
  );
}
