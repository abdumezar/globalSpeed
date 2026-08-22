import { ModalBase } from "../comps/ModalBase"
import { URLCondition } from "../types"
import { URLConditionContext, URLConditionEditor } from "./URLConditionEditor"
import "./URLModal.css"

type Props = {
	onClose: () => void
	onChange: (value: URLCondition) => void
	onReset: () => void
	value: URLCondition
	context: URLConditionContext
}

export function URLModal(props: Props) {
	return (
		<ModalBase keepOnWheel={true} onClose={props.onClose}>
			<div className="URLModal ModalMain">
				<URLConditionEditor
					title={gvar.gsm.options.rules.conditions}
					value={props.value}
					onChange={props.onChange}
					onReset={props.onReset}
					context={props.context}
				/>
			</div>
		</ModalBase>
	)
}
