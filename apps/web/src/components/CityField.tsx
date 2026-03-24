"use client";

import { ChangeEvent, useEffect, useState } from "react";

import { getCitySelectValue, isMajorCity, MAJOR_CITIES, OTHER_CITY_VALUE } from "@/shared/cities";

type CityFieldProps = {
  id: string;
  label: string;
  value?: string;
  defaultValue?: string;
  name?: string;
  blankLabel?: string;
  helperText?: string;
  otherPlaceholder?: string;
  onChange?: (value: string) => void;
};

export default function CityField({
  id,
  label,
  value,
  defaultValue = "",
  name,
  blankLabel = "Select city",
  helperText,
  otherPlaceholder = "Enter another city",
  onChange,
}: CityFieldProps) {
  const isControlled = value !== undefined;
  const [internalValue, setInternalValue] = useState(defaultValue);
  const [otherMode, setOtherMode] = useState(() => getCitySelectValue(isControlled ? value : defaultValue) === OTHER_CITY_VALUE);

  const cityValue = isControlled ? (value ?? "") : internalValue;
  const selectValue = otherMode ? OTHER_CITY_VALUE : getCitySelectValue(cityValue);
  const showOtherInput = selectValue === OTHER_CITY_VALUE;

  useEffect(() => {
    const nextSelectValue = getCitySelectValue(cityValue);
    if (nextSelectValue === OTHER_CITY_VALUE) {
      setOtherMode(true);
      return;
    }
    if (cityValue.trim()) {
      setOtherMode(false);
    }
  }, [cityValue]);

  function updateValue(nextValue: string) {
    if (!isControlled) {
      setInternalValue(nextValue);
    }
    onChange?.(nextValue);
  }

  function handleSelectChange(e: ChangeEvent<HTMLSelectElement>) {
    const nextValue = e.target.value;
    if (nextValue === OTHER_CITY_VALUE) {
      setOtherMode(true);
      if (!showOtherInput || isMajorCity(cityValue)) {
        updateValue("");
      }
      return;
    }
    setOtherMode(false);
    updateValue(nextValue);
  }

  function handleOtherChange(e: ChangeEvent<HTMLInputElement>) {
    updateValue(e.target.value);
  }

  return (
    <div>
      <label className="label" htmlFor={id}>{label}</label>
      <select id={id} className="select" value={selectValue} onChange={handleSelectChange}>
        <option value="">{blankLabel}</option>
        {MAJOR_CITIES.map((city) => (
          <option key={city} value={city}>
            {city}
          </option>
        ))}
        <option value={OTHER_CITY_VALUE}>Other</option>
      </select>

      {showOtherInput ? (
        <input
          className="input spaced-top-sm"
          value={cityValue}
          onChange={handleOtherChange}
          placeholder={otherPlaceholder}
          aria-label={`${label} custom`}
        />
      ) : null}

      {name && cityValue.trim() ? <input type="hidden" name={name} value={cityValue.trim()} /> : null}
      {helperText ? <p className="helper-text">{helperText}</p> : null}
    </div>
  );
}
