import { produce } from "immer"
import { GoX } from "react-icons/go"
import { Tooltip } from "@/comps/Tooltip"
import { extractURLPartValueKey, getActiveParts, getSelectedParts } from "@/utils/configUtils"
import { ThrottledTextInput } from "../comps/ThrottledTextInput"
import { getDefaultURLConditionPart } from "../defaults"
import { URLCondition, URLConditionPart } from "../types"
import { findRemoveFromArray } from "../utils/helper"
import "./URLConditionEditor.css"

export type URLConditionContext = "keybinds" | "keybind" | "ghost" | "rule"

/** Plain-language description of what the condition currently does, e.g. "Websites where this rule will apply". */
export function getURLConditionSubheader(value: URLCondition, context: URLConditionContext) {
	const isNeutral = !getActiveParts(value).length
	const key = `${context}${isNeutral ? "Neutral" : value.block ? "Block" : "Allow"}`
	return { subheader: (gvar.gsm.options.rules.headers as any)[key] as string, isNeutral }
}

type Props = {
	value: URLCondition
	onChange: (value: URLCondition) => void
	onReset: () => void
	context: URLConditionContext
	/** Heading shown beside the allowlist/blocklist picker. */
	title: React.ReactNode
	className?: string
}

export function URLConditionEditor(props: Props) {
	const { value } = props
	const listKey = value.block ? "blockParts" : "allowParts"
	const parts = getSelectedParts(value)
	const { subheader, isNeutral } = getURLConditionSubheader(value, props.context)

	const onChangePart = (part: URLConditionPart) => {
		props.onChange(
			produce(value, (d) => {
				const idx = d[listKey].findIndex((p) => p.id === part.id)
				if (idx >= 0) {
					d[listKey][idx] = part
				}
			}),
		)
	}

	const onRemovePart = (part: URLConditionPart) => {
		props.onChange(
			produce(value, (d) => {
				findRemoveFromArray(d[listKey], (p) => p.id === part.id)
			}),
		)
	}

	return (
		<div className={`URLConditionEditor ${props.className || ""}`}>
			{/* Heading + match mode */}
			<div className="header">
				<div className="title">{props.title}</div>
				<select
					value={value.block ? "BLOCK" : "ALLOW"}
					onChange={(e) => {
						props.onChange(
							produce(value, (d) => {
								d.block = e.target.value === "BLOCK"
							}),
						)
					}}
				>
					<option value="ALLOW">{gvar.gsm.options.rules.allowlist}</option>
					<option value="BLOCK">{gvar.gsm.options.rules.blocklist}</option>
				</select>
			</div>

			{/* What the condition resolves to right now */}
			{subheader && <div className="subHeader">{`${subheader}${isNeutral ? "" : ":"}`}</div>}

			{/* Conditions */}
			<div className="parts">
				{parts.map((part) => (
					<URLConditionPartRow key={part.id} onChange={onChangePart} onRemove={onRemovePart} part={part} />
				))}
			</div>

			{/* Controls */}
			<div className="controls">
				<button
					onClick={(e) => {
						props.onChange(
							produce(value, (d) => {
								d[listKey].push(getDefaultURLConditionPart())
							}),
						)
					}}
				>
					{gvar.gsm.options.rules.addCondition}
				</button>
				{parts.length ? <button onClick={props.onReset}>{gvar.gsm.token.reset}</button> : <div></div>}
			</div>
		</div>
	)
}

function URLConditionPartRow(props: {
	part: URLConditionPart
	onChange: (part: URLConditionPart) => void
	onRemove: (part: URLConditionPart) => void
}) {
	const { part, onChange, onRemove } = props
	const valueKey = extractURLPartValueKey(part)

	return (
		<div className="part">
			{/* Status */}
			<Tooltip title={part.disabled ? gvar.gsm.token.on : gvar.gsm.token.off}>
				<input
					type="checkbox"
					checked={!part.disabled}
					onChange={() => {
						onChange(
							produce(part, (d) => {
								d.disabled = !d.disabled
							}),
						)
					}}
				/>
			</Tooltip>

			{/* Match type */}
			<select
				value={part.type}
				onChange={(e) => {
					onChange(
						produce(part, (d) => {
							d.type = e.target.value as any
						}),
					)
				}}
			>
				<option value={"STARTS_WITH"}>{gvar.gsm.options.rules.startsWith}</option>
				<option value={"CONTAINS"}>{gvar.gsm.options.rules.contains}</option>
				<option value={"REGEX"}>{gvar.gsm.options.rules.regex}</option>
			</select>

			{/* Terms */}
			<ThrottledTextInput
				value={part[valueKey]}
				onChange={(newValue) => {
					onChange(
						produce(part, (d) => {
							d[valueKey] = newValue
						}),
					)
				}}
			/>

			{/* Delete */}
			<Tooltip title={gvar.gsm.token.delete}>
				<button
					className="close icon"
					onClick={() => {
						onRemove(part)
					}}
				>
					<GoX size="1.6rem" />
				</button>
			</Tooltip>
		</div>
	)
}
