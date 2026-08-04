import { bn } from "@/i18n/messages/bn";
import { en, type Messages } from "@/i18n/messages/en";

export type Locale = "en" | "bn";

export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_STORAGE_KEY = "mess_locale_v1";

export const LOCALES: Locale[] = ["en", "bn"];

type DeepString<T> = {
  [K in keyof T]: T[K] extends string ? string : DeepString<T[K]>;
};

export type MessageTree = DeepString<Messages>;

const catalogs: Record<Locale, MessageTree> = {
  en,
  bn,
};

export type MessageKey = LeavePaths<Messages>;

type LeavePaths<T, P extends string = ""> = T extends string
  ? P extends ""
    ? never
    : P
  : {
      [K in keyof T & string]: LeavePaths<
        T[K],
        P extends "" ? K : `${P}.${K}`
      >;
    }[keyof T & string];

function getByPath(obj: unknown, path: string): string | undefined {
  const parts = path.split(".");
  let cur: unknown = obj;
  for (const part of parts) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return typeof cur === "string" ? cur : undefined;
}

export function getMessages(locale: Locale = DEFAULT_LOCALE): MessageTree {
  return catalogs[locale] ?? en;
}

export function t(
  key: MessageKey,
  vars?: Record<string, string | number>,
  locale: Locale = DEFAULT_LOCALE,
): string {
  const fromLocale = getByPath(getMessages(locale), key);
  const text = fromLocale ?? getByPath(en, key) ?? key;
  if (!vars) return text;
  return Object.entries(vars).reduce(
    (acc, [k, v]) => acc.replaceAll(`{${k}}`, String(v)),
    text,
  );
}

export function roleLabel(role: keyof Messages["roles"], locale?: Locale) {
  return t(`roles.${role}`, undefined, locale);
}

export function tagLabel(tag: string, locale?: Locale) {
  const key = `tags.${tag}`;
  const fromLocale = getByPath(getMessages(locale ?? DEFAULT_LOCALE), key);
  const text = fromLocale ?? getByPath(en, key);
  return text ?? tag;
}
