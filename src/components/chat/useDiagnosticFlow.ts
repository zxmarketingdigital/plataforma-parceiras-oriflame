"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fill } from "@/core/i18n";
import type {
  Answer,
  ApiOption,
  ApiQuestion,
  ChatCopy,
  ContactFields,
  DiagnosticResult,
  DiagnosticSession,
  FlowPhase,
  RetryOperation,
  Scenario,
  ScenarioKey,
  SupportedLanguage,
  UTMValues,
} from "./types";

interface FlowOptions {
  lang: SupportedLanguage;
  leaderSlug?: string;
  utm?: UTMValues;
  copy: ChatCopy;
}

interface ApiFailure extends Error {
  status?: number;
}

function apiFailure(message: string, status?: number): ApiFailure {
  const failure = new Error(message) as ApiFailure;
  failure.status = status;
  return failure;
}

async function requestJson<T>(url: string, init?: RequestInit, timeoutMs?: number): Promise<T> {
  const controller = new AbortController();
  const timeout = timeoutMs ? window.setTimeout(() => controller.abort(), timeoutMs) : undefined;
  try {
    const headers = new Headers(init?.headers);
    headers.set("content-type", "application/json");
    const response = await fetch(url, { ...init, signal: controller.signal, headers });
    if (!response.ok) throw apiFailure("request_failed", response.status);
    return await response.json() as T;
  } catch (error) {
    if ((error as ApiFailure).status) throw error;
    throw apiFailure("network_failed");
  } finally {
    if (timeout) window.clearTimeout(timeout);
  }
}

function isQuestion(value: unknown): value is ApiQuestion {
  if (!value || typeof value !== "object") return false;
  const question = value as Partial<ApiQuestion>;
  return typeof question.key === "string" && typeof question.text === "string" && Array.isArray(question.options)
    && question.options.every((option) => typeof option?.value === "string" && typeof option?.label === "string");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function hasExpectedQuestions(value: unknown): value is ApiQuestion[] {
  if (!Array.isArray(value) || value.length !== 7 || !value.every(isQuestion)) return false;
  const keys = value.map((question) => question.key);
  const profileKeys = keys.filter((key) => key !== "pais");
  return new Set(keys).size === 7 && keys.filter((key) => key === "pais").length === 1 && profileKeys.length === 6;
}

function currenciesFrom(value: unknown): Record<string, string> {
  if (!isRecord(value)) return {};
  const currencies: Record<string, string> = {};
  for (const [country, currency] of Object.entries(value)) {
    if (/^[A-Z]{2}$/.test(country) && typeof currency === "string" && currency.trim().length > 0) currencies[country] = currency;
  }
  return currencies;
}

function fillCurrency(questions: ApiQuestion[], currency: string): ApiQuestion[] {
  return questions.map((question) => ({
    ...question,
    text: fill(question.text, { currency }),
    options: question.options.map((option) => ({ ...option, label: fill(option.label, { currency }) })),
  }));
}

function isScenario(value: unknown): value is Scenario {
  if (!isRecord(value)) return false;
  return Array.isArray(value.monthly)
    && value.monthly.length === 12
    && value.monthly.every((month) => typeof month === "number" && Number.isFinite(month))
    && typeof value.month12 === "number"
    && Number.isFinite(value.month12)
    && typeof value.avg_monthly === "number"
    && Number.isFinite(value.avg_monthly)
    && typeof value.rank_label === "string";
}

function hasValidScenarios(value: unknown): value is Record<ScenarioKey, Scenario> {
  if (!isRecord(value)) return false;
  const keys: ScenarioKey[] = ["conservador", "provavel", "ambicioso"];
  return keys.every((key) => isScenario(value[key]));
}

function isResultPlanWeek(value: unknown): value is DiagnosticResult["plan30"][number] {
  return isRecord(value)
    && typeof value.week === "number"
    && Number.isFinite(value.week)
    && typeof value.title === "string"
    && Array.isArray(value.actions)
    && value.actions.every((action) => typeof action === "string");
}

function isDiagnosticResult(value: unknown): value is DiagnosticResult {
  if (!isRecord(value) || !hasValidScenarios(value.scenarios)) return false;
  if (typeof value.currency !== "string" || !/^[A-Z]{3}$/.test(value.currency)) return false;
  if (typeof value.is_example !== "undefined" && typeof value.is_example !== "boolean") return false;
  if (typeof value.example_notice !== "undefined" && value.example_notice !== null && typeof value.example_notice !== "string") return false;
  if (!Array.isArray(value.assumptions) || !value.assumptions.every((assumption) => typeof assumption === "string")) return false;
  if (typeof value.profile !== "string" || typeof value.profile_label !== "string" || typeof value.analysis !== "string") return false;
  if (!Array.isArray(value.plan30) || !value.plan30.every(isResultPlanWeek)) return false;
  if (!isRecord(value.cta) || !isRecord(value.cta.leader) || typeof value.cta.leader.name !== "string") return false;
  return (typeof value.cta.signup_url === "undefined" || typeof value.cta.signup_url === "string")
    && (typeof value.cta.whatsapp_url === "undefined" || value.cta.whatsapp_url === null || typeof value.cta.whatsapp_url === "string")
    && (typeof value.disclaimer === "undefined" || typeof value.disclaimer === "string")
    && (typeof value.pdf_status === "undefined" || typeof value.pdf_status === "string");
}

function failureMessage(error: unknown, copy: ChatCopy) {
  return (error as ApiFailure).status === 429 ? copy.errors.rate_limit : copy.errors.network;
}

export function useDiagnosticFlow({ lang, leaderSlug, utm, copy }: FlowOptions) {
  const [phase, setPhase] = useState<FlowPhase>("loading");
  const [questions, setQuestions] = useState<ApiQuestion[]>([]);
  const questionTemplates = useRef<ApiQuestion[]>([]);
  const [currencies, setCurrencies] = useState<Record<string, string>>({});
  const [session, setSession] = useState<DiagnosticSession | null>(null);
  const [contact, setContact] = useState<ContactFields | null>(null);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [pendingAnswer, setPendingAnswer] = useState<ApiOption | null>(null);
  const [result, setResult] = useState<DiagnosticResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryOperation, setRetryOperation] = useState<RetryOperation>(null);
  const loadStarted = useRef(false);
  const operationInFlight = useRef<RetryOperation>(null);

  const countryQuestion = useMemo(() => questions.find((question) => question.key === "pais") ?? null, [questions]);
  const profileQuestions = useMemo(() => questions.filter((question) => question.key !== "pais"), [questions]);
  const currentQuestion = profileQuestions[questionIndex] ?? null;

  const loadQuestions = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const data = await requestJson<{ questions?: unknown; currencies?: unknown }>(`/api/diagnostico/perguntas?lang=${encodeURIComponent(lang)}`, { cache: "no-store" });
      if (!hasExpectedQuestions(data.questions)) {
        throw apiFailure("invalid_questions");
      }
      questionTemplates.current = data.questions;
      setQuestions(data.questions);
      setCurrencies(currenciesFrom(data.currencies));
      setPhase("contact");
      setRetryOperation(null);
    } catch (requestError) {
      setError(failureMessage(requestError, copy));
      setRetryOperation("questions");
      setPhase("contact");
    } finally {
      setBusy(false);
    }
  }, [copy, lang]);

  const questionsForCountry = useCallback(async (country: string) => {
    const currency = currencies[country];
    if (currency) return fillCurrency(questionTemplates.current, currency);

    const data = await requestJson<{ questions?: unknown; currencies?: unknown }>(
      `/api/diagnostico/perguntas?lang=${encodeURIComponent(lang)}&country=${encodeURIComponent(country)}`,
      { cache: "no-store" },
    );
    if (!hasExpectedQuestions(data.questions)) throw apiFailure("invalid_questions");

    const refreshedCurrencies = currenciesFrom(data.currencies);
    setCurrencies(refreshedCurrencies);
    return refreshedCurrencies[country] ? fillCurrency(data.questions, refreshedCurrencies[country]) : data.questions;
  }, [currencies, lang, questions]);

  useEffect(() => {
    if (loadStarted.current) return;
    loadStarted.current = true;
    void loadQuestions();
  }, [loadQuestions]);

  const persistCountry = useCallback(async (activeSession: DiagnosticSession, activeContact: ContactFields) => {
    setBusy(true);
    setError(null);
    try {
      const localizedQuestions = await questionsForCountry(activeContact.country);
      const response = await requestJson<{ ok?: boolean }>(`/api/diagnostico/${encodeURIComponent(activeSession.id)}/answer`, {
        method: "POST",
        body: JSON.stringify({ token: activeSession.token, key: "pais", value: activeContact.country }),
      });
      if (!response.ok) throw apiFailure("answer_failed");
      setQuestions(localizedQuestions);
      setAnswers([{ key: "pais", value: activeContact.country, label: countryQuestion?.options.find((option) => option.value === activeContact.country)?.label ?? activeContact.country }]);
      setPendingAnswer(null);
      setQuestionIndex(0);
      setPhase("questions");
      setRetryOperation(null);
    } catch (requestError) {
      setError(failureMessage(requestError, copy));
      setRetryOperation("country");
      setPhase("contact");
    } finally {
      setBusy(false);
    }
  }, [copy, countryQuestion, questionsForCountry]);

  const sendCountry = useCallback(async (activeSession: DiagnosticSession, activeContact: ContactFields) => {
    if (operationInFlight.current) return;
    operationInFlight.current = "country";
    try {
      await persistCountry(activeSession, activeContact);
    } finally {
      operationInFlight.current = null;
    }
  }, [persistCountry]);

  const startContact = useCallback(async (nextContact: ContactFields) => {
    if (operationInFlight.current) return;
    setContact(nextContact);
    if (session) {
      await sendCountry(session, nextContact);
      return;
    }

    operationInFlight.current = "start";
    setBusy(true);
    setError(null);
    try {
      const payload = {
        name: nextContact.name,
        email: nextContact.email,
        whatsapp: nextContact.whatsapp,
        country: nextContact.country,
        consent: nextContact.consent,
        lang,
        ...(leaderSlug ? { leader: leaderSlug } : {}),
        ...(utm && Object.keys(utm).length > 0 ? { utm } : {}),
        website: nextContact.website,
      };
      const created = await requestJson<Partial<DiagnosticSession>>("/api/diagnostico/start", { method: "POST", body: JSON.stringify(payload) });
      if (typeof created.id !== "string" || typeof created.token !== "string") throw apiFailure("invalid_session");
      const createdSession = { id: created.id, token: created.token };
      setSession(createdSession);
      await persistCountry(createdSession, nextContact);
    } catch (requestError) {
      setError(failureMessage(requestError, copy));
      setRetryOperation("start");
      setPhase("contact");
    } finally {
      operationInFlight.current = null;
      setBusy(false);
    }
  }, [copy, lang, leaderSlug, persistCountry, sendCountry, session, utm]);

  const requestFinish = useCallback(async (activeSession: DiagnosticSession) => {
    setPhase("finishing");
    setBusy(true);
    setError(null);
    try {
      const completed = await requestJson<DiagnosticResult>(`/api/diagnostico/${encodeURIComponent(activeSession.id)}/finish`, {
        method: "POST",
        body: JSON.stringify({ token: activeSession.token }),
      }, 31_000);
      if (!isDiagnosticResult(completed)) throw apiFailure("invalid_result");
      setResult(completed);
      setPhase("result");
      setRetryOperation(null);
    } catch (requestError) {
      setError(failureMessage(requestError, copy));
      setRetryOperation("finish");
      setPhase("finishing");
    } finally {
      setBusy(false);
    }
  }, [copy]);

  const finish = useCallback(async (activeSession: DiagnosticSession) => {
    if (operationInFlight.current) return;
    operationInFlight.current = "finish";
    try {
      await requestFinish(activeSession);
    } finally {
      operationInFlight.current = null;
    }
  }, [requestFinish]);

  const submitAnswer = useCallback(async (option: ApiOption) => {
    if (!session || !currentQuestion || busy || operationInFlight.current) return;
    operationInFlight.current = "answer";
    setBusy(true);
    setError(null);
    setPendingAnswer(option);
    try {
      const response = await requestJson<{ ok?: boolean }>(`/api/diagnostico/${encodeURIComponent(session.id)}/answer`, {
        method: "POST",
        body: JSON.stringify({ token: session.token, key: currentQuestion.key, value: option.value }),
      });
      if (!response.ok) throw apiFailure("answer_failed");
      setAnswers((current) => {
        const nextAnswer = { key: currentQuestion.key, value: option.value, label: option.label };
        const existingIndex = current.findIndex((answer) => answer.key === currentQuestion.key);
        return existingIndex === -1
          ? [...current, nextAnswer]
          : current.map((answer, index) => index === existingIndex ? nextAnswer : answer);
      });
      setPendingAnswer(null);
      const nextIndex = questionIndex + 1;
      if (nextIndex < profileQuestions.length) {
        setQuestionIndex(nextIndex);
        setRetryOperation(null);
        return;
      }
      await requestFinish(session);
    } catch (requestError) {
      setError(failureMessage(requestError, copy));
      setRetryOperation("answer");
    } finally {
      operationInFlight.current = null;
      setBusy(false);
    }
  }, [busy, copy, currentQuestion, profileQuestions.length, questionIndex, requestFinish, session]);

  const retry = useCallback(async () => {
    if (retryOperation === "questions") return loadQuestions();
    if (retryOperation === "country" && session && contact) return sendCountry(session, contact);
    if (retryOperation === "answer" && pendingAnswer) return submitAnswer(pendingAnswer);
    if (retryOperation === "finish" && session) return finish(session);
    setError(null);
    setRetryOperation(null);
  }, [contact, finish, loadQuestions, pendingAnswer, retryOperation, sendCountry, session, submitAnswer]);

  const restart = useCallback(() => {
    operationInFlight.current = null;
    setSession(null);
    setContact(null);
    setAnswers([]);
    setQuestionIndex(0);
    setPendingAnswer(null);
    setResult(null);
    setError(null);
    setRetryOperation(null);
    setPhase("contact");
  }, []);

  return {
    phase,
    questions,
    countryQuestion,
    currentQuestion,
    session,
    contact,
    answers,
    result,
    busy,
    error,
    retryOperation,
    completed: answers.length,
    loadQuestions,
    startContact,
    submitAnswer,
    retry,
    restart,
  };
}
