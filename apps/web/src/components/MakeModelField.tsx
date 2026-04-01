"use client";

import { useEffect, useRef, useState } from "react";

import { useLocale } from "@/components/LocaleProvider";
import { CAR_MAKES, findMake, getLogoUrl, type CarMake } from "@/shared/carMakes";

type MakeModelFieldProps = {
  defaultMake?: string;
  defaultModel?: string;
};

function BrandLogo({ domain, name }: { domain: string; name: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <span className="make-logo-fallback" aria-hidden="true">
        {name.charAt(0)}
      </span>
    );
  }
  return (
    <img
      src={getLogoUrl(domain)}
      alt=""
      className="make-option-logo"
      width={22}
      height={22}
      onError={() => setFailed(true)}
    />
  );
}

export default function MakeModelField({
  defaultMake = "",
  defaultModel = "",
}: MakeModelFieldProps) {
  const locale = useLocale();
  const isArabic = locale === "ar";

  const [selectedMake, setSelectedMake] = useState(defaultMake);
  const [selectedModel, setSelectedModel] = useState(defaultModel);
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");

  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const makeData = findMake(selectedMake);
  const models = makeData?.models ?? [];

  const filteredMakes: (CarMake & { logoUrl: string })[] = query.trim()
    ? CAR_MAKES.filter((m) =>
        m.name.toLowerCase().includes(query.toLowerCase()) ||
        m.nameAr.includes(query)
      ).map((m) => ({ ...m, logoUrl: getLogoUrl(m.domain) }))
    : CAR_MAKES.map((m) => ({ ...m, logoUrl: getLogoUrl(m.domain) }));

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 40);
    }
  }, [isOpen]);

  useEffect(() => {
    function handleOutsideClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [isOpen]);

  function selectMake(makeName: string) {
    setSelectedMake(makeName);
    setSelectedModel("");
    setIsOpen(false);
    setQuery("");
  }

  const labels = isArabic
    ? { make: "الشركة", model: "الموديل", anyMake: "أي شركة", anyModel: "أي موديل", search: "ابحث عن شركة..." }
    : { make: "Make", model: "Model", anyMake: "Any make", anyModel: "Any model", search: "Search makes..." };

  return (
    <div ref={containerRef} className="make-model-wrap">
      {/* ── Make Dropdown ─────────────────────────────────────── */}
      <div>
        <label className="label" htmlFor="make-trigger">{labels.make}</label>
        <button
          id="make-trigger"
          type="button"
          className="make-trigger"
          onClick={() => setIsOpen((v) => !v)}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
        >
          <span className="make-trigger-content">
            {makeData ? (
              <>
                <BrandLogo domain={makeData.domain} name={makeData.name} />
                <span className="make-trigger-name">{makeData.name}</span>
              </>
            ) : selectedMake ? (
              <span className="make-trigger-name">{selectedMake}</span>
            ) : (
              <span className="make-trigger-placeholder">{labels.anyMake}</span>
            )}
          </span>
          <svg className="make-trigger-chevron" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        {isOpen && (
          <div className="make-panel" role="listbox" aria-label={labels.make}>
            <div className="make-panel-search">
              <svg className="make-panel-search-icon" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <circle cx="6.5" cy="6.5" r="4" stroke="currentColor" strokeWidth="1.6" />
                <path d="M11 11l2.5 2.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
              <input
                ref={searchInputRef}
                className="make-panel-search-input"
                placeholder={labels.search}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label={labels.search}
              />
              {query && (
                <button
                  type="button"
                  className="make-panel-search-clear"
                  onClick={() => setQuery("")}
                  aria-label="Clear search"
                >
                  ×
                </button>
              )}
            </div>

            <div className="make-option-list" role="presentation">
              <button
                type="button"
                role="option"
                aria-selected={!selectedMake}
                className={`make-option ${!selectedMake ? "make-option-active" : ""}`}
                onClick={() => selectMake("")}
              >
                <span className="make-logo-fallback" aria-hidden="true">—</span>
                <span>{labels.anyMake}</span>
              </button>

              {filteredMakes.map((make) => (
                <button
                  key={make.key}
                  type="button"
                  role="option"
                  aria-selected={selectedMake.toLowerCase() === make.name.toLowerCase()}
                  className={`make-option ${selectedMake.toLowerCase() === make.name.toLowerCase() ? "make-option-active" : ""}`}
                  onClick={() => selectMake(make.name)}
                >
                  <BrandLogo domain={make.domain} name={make.name} />
                  <span className="make-option-name">{make.name}</span>
                  {isArabic && <span className="make-option-name-ar">{make.nameAr}</span>}
                </button>
              ))}

              {filteredMakes.length === 0 && (
                <p className="make-no-results">
                  {isArabic ? "ما فيه نتائج" : "No results"}
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Hidden input so the value submits with the form */}
      <input type="hidden" name="make" value={selectedMake} />

      {/* ── Model Field ────────────────────────────────────────── */}
      <div className="make-model-gap">
        <label className="label" htmlFor="model-field">{labels.model}</label>

        {models.length > 0 ? (
          <select
            id="model-field"
            name="model"
            className="select"
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
          >
            <option value="">{labels.anyModel}</option>
            {models.map((model) => (
              <option key={model} value={model}>
                {model}
              </option>
            ))}
          </select>
        ) : (
          <input
            id="model-field"
            name="model"
            className="input"
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            placeholder={isArabic ? "مثل: كامري" : "e.g. Camry"}
          />
        )}
      </div>
    </div>
  );
}
