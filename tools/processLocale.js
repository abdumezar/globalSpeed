// /// <reference types="@types/node" />

const { readdir, readFile, writeFile, mkdir } = require("fs/promises")
const { join, parse } = require("path")
const { env, argv, exit } = require("process")

// Arabic has no letter case, so nothing needs casing adjustment today. New
// languages that do go here.
const CASING_SENSITIVE_LANGUAGES = []
const ALL_LANGUAGES = [...CASING_SENSITIVE_LANGUAGES, "ar"]

async function main() {
	if (argv[2] === "--casing") {
		ensureCasing()
	} else if (argv[2] === "--punctuation") {
		ensurePunctuation()
	} else if (argv[2] === "--build") {
		build()
	} else {
		await adhereEnglish()
	}
}

async function adhereEnglish() {
	/** @type {Record<string, string[]>} */
	const missingByLang = {}
	let rootLocales = join("static", "locales")
	let englishLocale = join(rootLocales, "en.json")
	const englishJson = JSON.parse(await readFile(englishLocale))
	const englishLeaves = getLeaves(englishJson)
	for (let lang of ALL_LANGUAGES) {
		const path = join(rootLocales, `${lang}.json`)
		const json = JSON.parse(await readFile(path), { encoding: "utf8" })
		const leaves = getLeaves(json)
		const dots = new Set(leaves.map((l) => l.dots))
		const englishDotsSet = new Set(englishLeaves.map((l) => l.dots))

		// Detect cross-group moves: only when a base name appears exactly once
		// among orphaned keys (deleted) and exactly once among new keys (added)
		const orphanCounts = new Map()
		const orphanedByBase = new Map()
		for (let leaf of leaves) {
			if (!englishDotsSet.has(leaf.dots)) {
				orphanCounts.set(leaf.key, (orphanCounts.get(leaf.key) ?? 0) + 1)
				orphanedByBase.set(leaf.key, { path: leaf.path, value: leaf.value })
			}
		}
		for (let [key, count] of orphanCounts) {
			if (count > 1) console.warn(`(${lang}) Warning: orphaned key "${key}" appears ${count} times, skipping move detection for it`)
		}

		let newJson = {}
		/** Keys present in en.json that this locale has no translation for. */
		let untranslated = []

		for (let leaf of englishLeaves) {
			let base = leaf.path.at(-1)

			if (dots.has(leaf.dots)) {
				setNestedValue(newJson, leaf.path, getNestedValue(json, leaf.path))
			} else if (orphanedByBase.has(base) && orphanCounts.get(base) === 1) {
				// Key was moved to a different group - reuse existing translation
				const orphan = orphanedByBase.get(base)
				setNestedValue(newJson, leaf.path, orphan.value)
				orphanedByBase.delete(base)
				console.log(`(${lang}) Moved ${orphan.path.join(".")} -> ${leaf.dots}`)
			} else {
				if (base.startsWith("_")) continue

				// Fall back to the English copy so the UI renders a real string
				// instead of "undefined", and report it so a human can supply the
				// actual translation.
				setNestedValue(newJson, leaf.path, leaf.value)
				if (leaf.value) untranslated.push(leaf.dots)
			}
		}

		await writeFile(path, JSON.stringify(newJson, null, "\t") + "\n", {
			encoding: "utf8",
		})

		if (untranslated.length) {
			missingByLang[lang] = untranslated
			console.warn(`(${lang}) ${untranslated.length} key(s) need translation:`)
			for (let dots of untranslated) console.warn(`    ${dots} = ${JSON.stringify(getNestedValue(englishJson, dots.split(".")))}`)
		} else {
			console.log(`(${lang}) up to date.`)
		}
	}

	const langs = Object.keys(missingByLang)
	if (langs.length) {
		const total = langs.reduce((sum, l) => sum + missingByLang[l].length, 0)
		console.error(`\n${total} string(s) across ${langs.length} locale(s) fell back to English. Translate them in static/locales/, then re-run.`)
		exit(1)
	}
}

async function ensureCasing() {
	let rootLocales = join("static", "locales")
	let englishLocale = join(rootLocales, "en.json")
	const englishJson = JSON.parse(await readFile(englishLocale))
	let englishLeaves = getLeaves(englishJson, [], true)
	englishLeaves.forEach((leave) => {
		if (leave.value && typeof leave.value === "string") {
			leave.isCapitalized = isCapitalized(leave.value, "en")
		}
	})
	englishLeaves = englishLeaves.filter((leave) => leave.isCapitalized)

	for (let lang of CASING_SENSITIVE_LANGUAGES) {
		const path = join(rootLocales, `${lang}.json`)
		const otherJson = JSON.parse(await readFile(path, { encoding: "utf8" }))
		let adjustedCount = 0

		for (let leave of englishLeaves) {
			let locale = lang.replace("_", "-")
			const value = getNestedValue(otherJson, leave.path)
			if (!value || typeof value !== "string") continue
			if (firstLetterIndex(value) !== 0) continue
			if (!isCapitalized(value, locale)) {
				setNestedValue(otherJson, leave.path, capitalize(value, locale))
				adjustedCount++
			}
		}
		adjustedCount &&
			(await writeFile(path, JSON.stringify(otherJson, null, "\t") + "\n", {
				encoding: "utf8",
			}))
		console.log(`${lang}.json required ${adjustedCount} adjustments.`)
	}
}

async function ensurePunctuation() {
	let rootLocales = join("static", "locales")

	for (let lang of ["en", ...ALL_LANGUAGES]) {
		const path = join(rootLocales, `${lang}.json`)
		const json = JSON.parse(await readFile(path, { encoding: "utf8" }))
		const leaves = getLeaves(json)
		let adjustedCount = 0

		for (let leaf of leaves) {
			if (leaf.path[0].startsWith(":")) continue
			if (typeof leaf.value !== "string" || !leaf.value) continue

			const v = leaf.value
			const endsWithPeriod = v.endsWith(".") || v.endsWith("\u3002")
			if (!endsWithPeriod) continue
			if (v.endsWith("...")) continue
			if (v.includes("\n")) continue
			if (/\. [A-Z]/.test(v)) continue
			if (v.indexOf("\u3002") >= 0 && v.indexOf("\u3002") < v.length - 1) continue

			setNestedValue(json, leaf.path, v.slice(0, -1))
			adjustedCount++
		}

		if (adjustedCount) {
			await writeFile(path, JSON.stringify(json, null, "\t") + "\n", { encoding: "utf8" })
		}
		console.log(`${lang}.json: ${adjustedCount} period adjustments`)
	}
}

async function build() {
	let root = join(env["FIREFOX"] ? "buildFf" : "build", "unpacked", "locales")
	let formalRoot = join(env["FIREFOX"] ? "buildFf" : "build", "unpacked", "_locales")
	let paths = []
	await walkDir(root, paths)
	paths = paths.filter((v) => v.endsWith(".json"))
	await Promise.all(
		paths.map(async (path) => {
			const localeData = JSON.parse(await readFile(path, { encoding: "utf8" }))
			const language = parse(path).name
			const formalObj = extractToplevelKeysByPrefix(localeData)
			await mkdir(join(formalRoot, language), { recursive: true })
			await writeFile(path, JSON.stringify(localeData)) // minify
			await writeFile(join(formalRoot, language, "messages.json"), JSON.stringify(formalObj))
		}),
	)
}

/**
 *
 * @param {any} data
 * @param {string} prefix
 * @returns
 */
function extractToplevelKeysByPrefix(data, prefix = ":") {
	let newObj = {}
	for (let key of Object.keys(data)) {
		if (key.startsWith(prefix)) {
			const newKey = key.slice(1)
			newObj[newKey] = { message: data[key] }
			delete data[key]
		}
	}
	return newObj
}

/**
 * @param {string} dir
 * @param {string[]} paths
 */
async function walkDir(dir, paths) {
	await Promise.all(
		(await readdir(dir, { withFileTypes: true })).map(async (item) => {
			let itemPath = join(dir, item.name)
			if (item.isDirectory()) {
				await walkDir(itemPath, paths)
			} else {
				paths.push(itemPath)
			}
		}),
	)
}

/**
 * @param {any} obj
 * @param {string[]} keys
 * @returns {any}
 */
function getNestedValue(obj, keys) {
	return keys.reduce((current, key) => current?.[key], obj)
}

/**
 * @param {any} obj
 * @param {string[]} keys
 * @param {any} value
 */
function setNestedValue(obj, keys, value) {
	let lastKey = keys[keys.length - 1]
	keys = keys.slice(0, keys.length - 1)
	keys.forEach((key) => {
		if (obj[key] && typeof obj[key] !== "object") throw "Keys lead to a non-object structure."
		obj[key] = obj[key] || {}
		obj = obj[key]
	})
	obj[lastKey] = value
	if (value === undefined) delete obj[lastKey]
}

/**
 *
 * @param {any} obj
 * @param {string[]} ctx
 * @param {boolean} ignoreOptional
 * @returns {{path: string[], dots: string, key: string, value: any}[]}
 */
function getLeaves(obj, ctx = [], ignoreOptional = false) {
	const leafs = []
	for (let key in obj) {
		if (ignoreOptional && key.startsWith("_")) continue
		if (typeof obj[key] === "object") {
			leafs.push(...getLeaves(obj[key], [...ctx, key], ignoreOptional))
		} else {
			leafs.push({
				path: [...ctx, key],
				dots: [...ctx, key].join("."),
				key,
				value: obj[key],
			})
		}
	}

	return leafs
}

function firstLetterIndex(text) {
	for (let i = 0; i < text.length; i++) {
		if (text[i].toLocaleUpperCase() !== text[i].toLocaleLowerCase()) return i
	}
	return -1
}

function isCapitalized(text, locale) {
	if (!text) return
	const i = firstLetterIndex(text)
	if (i < 0) return
	return text[i].toLocaleUpperCase(locale.replace("_", "-")) === text[i]
}

function capitalize(text, locale) {
	if (!text) return
	const i = firstLetterIndex(text)
	if (i < 0) return text
	const textArray = [...text]
	textArray[i] = textArray[i].toLocaleUpperCase(locale.replace("_", "-"))
	return textArray.join("")
}

main()
