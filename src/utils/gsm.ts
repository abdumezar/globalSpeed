import { Gsm } from "./GsmType"

// Adding a language guide
// Add language code to AVAILABLE_LOCALES (this file)
// Add language information to LOCALE_MAP (this file)
// Add language to static/locales folder for translations.

declare global {
	interface Window {
		gsm?: Gsm
	}
}

export async function loadGsm(): Promise<Gsm> {
	const language = (await chrome.storage.local.get("g:language"))["g:language"] as string
	return readLocaleFile(getValidLocale(language))
}

export async function requestGsm(): Promise<Gsm> {
	return chrome.runtime.sendMessage({ type: "REQUEST_GSM" })
}

export async function readLocaleFile(locale: string): Promise<Gsm> {
	const fetched = await fetch(chrome.runtime.getURL(`locales/${locale}.json`))
	const json = (await fetched.json()) as Gsm
	json._lang = locale.replace("_", "-")
	return json
}

function getValidLocale(overrideLang?: string) {
	if (overrideLang && AVAILABLE_LOCALES.has(overrideLang)) return overrideLang
	const languages: Set<string> = new Set()
	for (let lang of navigator.languages.map((l) => l.replace("-", "_"))) {
		languages.add(lang)
		languages.add(lang.split("_")[0])
	}
	languages.add("en")
	return [...languages].find((l) => AVAILABLE_LOCALES.has(l))
}

export const LOCALE_MAP: {
	[key: string]: {
		display: string
		title: string
	}
} = {
	detect: { display: "Auto", title: "" },
	ar: { display: "عربي", title: "Arabic" },
	en: { display: "English", title: "English" },
}

const AVAILABLE_LOCALES = new Set(["ar", "en"])
