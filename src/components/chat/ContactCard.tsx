"use client";

import { parsePhoneNumberFromString } from "libphonenumber-js";
import { useMemo, useState } from "react";
import { brandVars } from "@/core/brand";
import type { ApiOption, ChatCopy, ContactFields, SupportedCountry } from "./types";
import { fill } from "@/core/i18n";
import styles from "./DiagnosticChat.module.css";

interface ContactCardProps {
  copy: ChatCopy["contact_step"];
  leaderName: string;
  leaderBrandName: string;
  countries: ApiOption[];
  busy?: boolean;
  serverError?: string | null;
  onSubmit: (contact: ContactFields) => void;
}

type FieldErrors = Partial<Record<"name" | "email" | "whatsapp" | "country" | "consent", string>>;
const supportedCountries = new Set<SupportedCountry>(["PT", "ES", "FR", "GB"]);

export function ContactCard({ copy, leaderName, leaderBrandName, countries, busy = false, serverError, onSubmit }: ContactCardProps) {
  const initialCountry = useMemo(
    () => (countries.some((country) => country.value === "PT") ? "PT" : (countries[0]?.value ?? "")),
    [countries],
  );
  const [fields, setFields] = useState({
    name: "",
    email: "",
    whatsapp: "",
    country: initialCountry,
    consent: false,
    website: "",
  });
  const [errors, setErrors] = useState<FieldErrors>({});

  const update = (name: keyof typeof fields, value: string | boolean) => {
    setFields((current) => ({ ...current, [name]: value }));
    if (name !== "website") {
      setErrors((current) => ({ ...current, [name]: undefined }));
    }
  };

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors: FieldErrors = {};
    const name = fields.name.trim();
    const email = fields.email.trim();
    const phone = parsePhoneNumberFromString(fields.whatsapp.trim());

    if (!name) nextErrors.name = copy.errors.name;
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) nextErrors.email = copy.errors.email;
    if (!phone?.isValid()) nextErrors.whatsapp = copy.errors.whatsapp;
    if (!supportedCountries.has(fields.country as SupportedCountry) || !countries.some((country) => country.value === fields.country)) nextErrors.country = copy.errors.generic;
    if (!fields.consent) nextErrors.consent = copy.errors.consent;
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0 || !phone) return;
    onSubmit({
      name,
      email,
      whatsapp: phone.number,
      country: fields.country as SupportedCountry,
      consent: fields.consent,
      website: fields.website,
    });
  };

  return (
    <form className={styles.contactCard} onSubmit={submit} noValidate>
      <p>{copy.intro}</p>
      <label>
        <span>{copy.name_label}</span>
        <input value={fields.name} onChange={(event) => update("name", event.target.value)} autoComplete="name" aria-invalid={Boolean(errors.name)} />
        {errors.name ? <small role="alert">{errors.name}</small> : null}
      </label>
      <label>
        <span>{copy.email_label}</span>
        <input value={fields.email} onChange={(event) => update("email", event.target.value)} type="email" autoComplete="email" aria-invalid={Boolean(errors.email)} />
        {errors.email ? <small role="alert">{errors.email}</small> : null}
      </label>
      <label>
        <span>{copy.whatsapp_label}</span>
        <input value={fields.whatsapp} onChange={(event) => update("whatsapp", event.target.value)} type="tel" inputMode="tel" autoComplete="tel" aria-invalid={Boolean(errors.whatsapp)} />
        {errors.whatsapp ? <small role="alert">{errors.whatsapp}</small> : null}
      </label>
      <label>
        <span>{copy.country_label}</span>
        <select value={fields.country} onChange={(event) => update("country", event.target.value)} aria-invalid={Boolean(errors.country)}>
          {countries.map((country) => <option key={country.value} value={country.value}>{country.label}</option>)}
        </select>
        {errors.country ? <small role="alert">{errors.country}</small> : null}
      </label>
      <label className={styles.consent}>
        <input checked={fields.consent} onChange={(event) => update("consent", event.target.checked)} type="checkbox" aria-invalid={Boolean(errors.consent)} />
        <span>{fill(copy.consent_text, brandVars(leaderName, leaderBrandName))}</span>
      </label>
      {errors.consent ? <small role="alert">{errors.consent}</small> : null}
      <input className={styles.honeypot} value={fields.website} onChange={(event) => update("website", event.target.value)} tabIndex={-1} autoComplete="off" aria-hidden="true" />
      {serverError ? <p className={styles.formError} role="alert">{serverError}</p> : null}
      <button className={styles.primaryButton} type="submit" disabled={busy}>{copy.submit}</button>
    </form>
  );
}
