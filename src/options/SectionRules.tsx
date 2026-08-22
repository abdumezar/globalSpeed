import clsx from "clsx"
import { produce } from "immer"
import { RefObject, useRef, useState } from "react"
import { GoChevronDown } from "react-icons/go"
import { MdWarning } from "react-icons/md"
import { GearIcon } from "@/comps/GearIcon"
import { Tooltip } from "@/comps/Tooltip"
import { extractURLPartValueKey, getActiveParts, getSelectedParts } from "@/utils/configUtils"
import { ModalBase } from "../comps/ModalBase"
import { ModalText } from "../comps/ModalText"
import { NumericInput } from "../comps/NumericInput"
import { ThrottledTextInput } from "../comps/ThrottledTextInput"
import { getDefaultFx, getDefaultURLCondition, getDefaultURLRule } from "../defaults"
import { useStateView } from "../hooks/useStateView"
import { FxControl } from "../popup/FxControl"
import { URLCondition, URLRule, URLStrictness } from "../types"
import { isFirefox, moveItem, randomId } from "../utils/helper"
import { DevWarning } from "./DevWarning"
import { KebabList, KebabListProps } from "./KebabList"
import { makeLabelWithTooltip } from "./keybindControl/NameArea"
import { List } from "./List"
import { ListItem } from "./ListItem"
import { getURLConditionSubheader, URLConditionEditor } from "./URLConditionEditor"
import "./SectionRules.css"

export function SectionRules(props: {}) {
	const [view, setView] = useStateView({ rules: true })
	const listRef = useRef<HTMLDivElement>(null)
	if (!view) return <div></div>

	const rules = view.rules || []

	const handleChange = (newRule: URLRule, remove?: boolean, duplicate?: boolean) => {
		setView({
			rules: produce(rules, (d) => {
				const idx = d.findIndex((v) => v.id === newRule.id)
				if (remove) {
					if (idx < 0) return
					d.splice(idx, 1)
					return
				}

				if (duplicate) {
					if (idx < 0) return
					const rule = structuredClone(newRule)
					rule.id = randomId()
					d.splice(idx, 0, rule)
					return
				}

				if (idx >= 0) {
					d[idx] = newRule
				} else {
					d.push(newRule)
				}
			}),
		})
	}

	const handleMove = (id: string, newIndex: number) => {
		setView({
			rules: produce(rules, (d) => {
				moveItem(d, (v) => v.id === id, newIndex)
			}),
		})
	}

	const handleSpacingChange = (index: number) => {
		setView({
			rules: produce(rules, (d) => {
				const rule = rules[index]
				if (!rule) return
				rule.spacing = ((rule.spacing || 0) + 1) % 3
			}),
		})
	}

	return (
		<div className="section SectionRules">
			<h2>{gvar.gsm.options.rules.header}</h2>
			{isFirefox() ? null : <DevWarning forUrlRules={true} hasJs={rules?.some((r) => r.enabled && r.type === "JS")} />}
			<List listRef={listRef} spacingChange={handleSpacingChange}>
				{rules.map((rule, i) => (
					<ListItem
						key={rule.id}
						isEnabled={rule.enabled}
						listRef={listRef}
						onMove={(newIdx) => handleMove(rule.id, newIdx)}
						spacing={rule.spacing}
						onRemove={() => handleChange(rule, true)}
						label={rule.label}
						onClearLabel={() => {
							handleChange(
								produce(rule, (d) => {
									delete d.label
								}),
							)
						}}
					>
						<Rule isLast={i === rules.length - 1} listRef={listRef} rule={rule} onChange={handleChange} />
					</ListItem>
				))}
			</List>
			<button className="create" onClick={(e) => handleChange(getDefaultURLRule())}>
				{gvar.gsm.token.create}
			</button>
		</div>
	)
}

type RuleProps = {
	rule: URLRule
	listRef: RefObject<HTMLElement>
	isLast?: boolean
	onChange: (rule: URLRule, remove?: boolean, duplicate?: boolean) => void
}

export function Rule(props: RuleProps) {
	const { rule, onChange } = props
	const [open, setOpen] = useState(false)

	const condition = rule.condition || getDefaultURLCondition()
	const { isNeutral } = getURLConditionSubheader(condition, "rule")

	const list: KebabListProps["list"] = [
		{ name: "duplicate", label: gvar.gsm.token.duplicate, close: true },
		{ name: "label", label: gvar.gsm.options.editor.addLabel, close: true },
	]

	props.isLast ||
		list.push({
			name: "spacing",
			label: gvar.gsm.options.editor.spacing,
			preLabel: props.rule.spacing === 2 ? "2" : props.rule.spacing === 1 ? "1" : null,
		})

	return (
		<div className={clsx("Rule", { open })}>
			{/* Status */}
			<Tooltip title={rule.enabled ? gvar.gsm.token.off : gvar.gsm.token.on}>
				<input
					type="checkbox"
					checked={!!rule.enabled}
					onChange={(e) => {
						onChange(
							produce(rule, (d) => {
								d.enabled = !d.enabled
							}),
						)
					}}
				/>
			</Tooltip>

			{/* Summary — click anywhere to expand */}
			<button className="summary" aria-expanded={open} onClick={() => setOpen(!open)}>
				<ConditionSummary condition={rule.condition} isNeutral={isNeutral} />
				<span className="arrow">→</span>
				<ActionSummary rule={rule} />
			</button>

			<KebabList
				list={list}
				onSelect={(name) => {
					if (name === "duplicate") {
						props.onChange(rule, false, true)
					} else if (name === "label") {
						props.onChange(
							produce(rule, (d) => {
								d.label = prompt()
								if (!d.label) delete d.label
							}),
						)
					} else if (name === "spacing") {
						props.onChange(
							produce(rule, (d) => {
								d.spacing = ((d.spacing || 0) + 1) % 3
							}),
						)
					}
				}}
			/>

			{/* Expand */}
			<Tooltip title={open ? gvar.gsm.token.hide : gvar.gsm.token.edit}>
				<button className="chevron icon" aria-expanded={open} onClick={() => setOpen(!open)}>
					<GoChevronDown size="1.4rem" />
				</button>
			</Tooltip>

			{open && <RuleDetails rule={rule} onChange={onChange} />}
		</div>
	)
}

function RuleDetails(props: { rule: URLRule; onChange: RuleProps["onChange"] }) {
	const { rule, onChange } = props

	return (
		<div className="details">
			{/* WHEN — url conditions */}
			<URLConditionEditor
				className="inline"
				title={gvar.gsm.options.rules.when}
				context="rule"
				value={rule.condition || getDefaultURLCondition()}
				onReset={() => {
					onChange(
						produce(rule, (d) => {
							delete d.condition
						}),
					)
				}}
				onChange={(v) => {
					onChange(
						produce(rule, (d) => {
							d.condition = v
						}),
					)
				}}
			/>

			{/* THEN — what the rule does */}
			<div className="then">
				<div className="fieldLabel">{gvar.gsm.options.rules.then}</div>
				<div className="action">
					<select
						value={rule.type}
						onChange={(e) => {
							onChange(
								produce(rule, (d) => {
									d.type = e.target.value as any
								}),
							)
						}}
					>
						<option value="ON">{gvar.gsm.token.on}</option>
						<option value="OFF">{gvar.gsm.token.off}</option>
						<option value="SPEED">{gvar.gsm.command.speed}</option>
						<option value="FX">{gvar.gsm.command.fxFilter}</option>
						<option value="JS">{gvar.gsm.command.runCode}</option>
					</select>

					{/* Speed input */}
					{rule.type === "SPEED" && (
						<NumericInput
							noNull={true}
							min={1 / 16}
							max={16}
							value={rule.overrideSpeed ?? 1}
							onChange={(v) => {
								onChange(
									produce(rule, (d) => {
										d.overrideSpeed = v
									}),
								)
							}}
						/>
					)}

					{/* FX input */}
					{rule.type === "FX" && <FxRuleControl rule={rule} onChange={onChange} />}

					{/* JS input */}
					{rule.type === "JS" && (
						<ModalText
							value={rule.overrideJs || ""}
							onChange={(v) => {
								onChange(
									produce(rule, (d) => {
										d.overrideJs = v
									}),
								)
							}}
						/>
					)}
				</div>
			</div>

			{/* Strictness — meaningless for JS rules, which run per injection. */}
			{rule.type !== "JS" && (
				<div className="option">
					<div className="fieldLabel">{makeLabelWithTooltip(gvar.gsm.options.rules.strictness, gvar.gsm.options.rules.strictnessTooltip)}</div>
					<select
						value={`${rule.strictness ?? URLStrictness.DIFFERENT_HOST}`}
						onChange={(e) => {
							onChange(
								produce(rule, (d) => {
									d.strictness = Number(e.target.value) as URLStrictness
								}),
							)
						}}
					>
						{([1, 2, 3, 4] as const).map((mode) => (
							<option key={mode} value={`${mode}`}>
								{gvar.gsm.options.rules.strictnessModes[`${mode}`]}
							</option>
						))}
					</select>
				</div>
			)}

			{/* Page title restriction */}
			<div className="option">
				<div className="fieldLabel">{makeLabelWithTooltip(gvar.gsm.options.rules.pageTitleLabel, gvar.gsm.options.rules.pageTitleTooltip)}</div>
				{/* Stored verbatim — the background lowercases and splits at match time. */}
				<ThrottledTextInput
					value={rule.titleRestrict || ""}
					onChange={(v) => {
						onChange(
							produce(rule, (d) => {
								const trimmed = (v || "").trim()
								if (trimmed) {
									d.titleRestrict = trimmed
								} else {
									delete d.titleRestrict
								}
							}),
						)
					}}
				/>
			</div>
		</div>
	)
}

/** Up to MAX_CHIPS patterns, then a "+N" overflow chip. */
const MAX_CHIPS = 3

function ConditionSummary(props: { condition?: URLCondition; isNeutral: boolean }) {
	const { condition, isNeutral } = props

	if (isNeutral) {
		return (
			<span className="conditions neutral">
				<MdWarning size="1.2rem" />
				{gvar.gsm.options.rules.headers.ruleNeutral}
			</span>
		)
	}

	const parts = getActiveParts(condition)
	const shown = parts.slice(0, MAX_CHIPS)
	const overflow = parts.length - shown.length

	return (
		<span className="conditions">
			<span className={clsx("mode", condition.block ? "block" : "allow")}>
				{condition.block ? gvar.gsm.options.rules.blocklist : gvar.gsm.options.rules.allowlist}
			</span>
			{shown.map((part) => {
				// An empty pattern matches every URL — show it as a wildcard rather than a blank chip.
				const term = (part[extractURLPartValueKey(part)] || "").trim()
				return (
					<span key={part.id} className={clsx("chip", { wildcard: !term })} title={term}>
						{term || "*"}
					</span>
				)
			})}
			{overflow > 0 && <span className="chip more">{`+${overflow}`}</span>}
		</span>
	)
}

function ActionSummary(props: { rule: URLRule }) {
	const { rule } = props

	let name: string
	let detail: string
	if (rule.type === "ON") {
		name = gvar.gsm.token.on
	} else if (rule.type === "OFF") {
		name = gvar.gsm.token.off
	} else if (rule.type === "SPEED") {
		name = gvar.gsm.command.speed
		detail = `${rule.overrideSpeed ?? 1}`
	} else if (rule.type === "FX") {
		name = gvar.gsm.command.fxFilter
	} else {
		name = gvar.gsm.command.runCode
	}

	return (
		<span className="action">
			<span className="name">{name}</span>
			{detail && <span className="value">{detail}</span>}
		</span>
	)
}

type FxRuleControlProps = {
	rule: URLRule
	onChange: (rule: URLRule, remove?: boolean) => void
}

function FxRuleControl(props: FxRuleControlProps) {
	const [open, setOpen] = useState(false)

	let overrideFx = (props.rule.overrideFx || {}) as typeof props.rule.overrideFx
	overrideFx.backdropFx = overrideFx.backdropFx || getDefaultFx()
	overrideFx.elementFx = overrideFx.elementFx || getDefaultFx()

	return (
		<div className="FxControlButton">
			<GearIcon onClick={(e) => setOpen(!open)} />
			{open && (
				<ModalBase keepOnWheel={true} onClose={() => setOpen(false)}>
					<FxControl
						enabled={true}
						_elementFx={overrideFx.elementFx}
						_backdropFx={overrideFx.backdropFx}
						handleChange={(elementFx, backdropFx) => {
							props.onChange(
								produce(props.rule, (d) => {
									d.overrideFx = {
										elementFx,
										backdropFx,
									}
								}),
							)
						}}
					/>
				</ModalBase>
			)}
		</div>
	)
}
