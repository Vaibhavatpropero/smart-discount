// app/components/discount-wizard/steps/ScheduleStep.jsx
export default function ScheduleStep({ state, errors }) {
    return (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <label className="block">
                <span className="mb-1 block text-sm font-medium text-gray-700">Start date & time</span>
                <input
                    type="datetime-local"
                    value={state.startsAt}
                    onChange={(e) => state.setStartsAt(e.target.value)}
                    className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-blue-500"
                />
            </label>

            <label className="block">
                <span className="mb-1 block text-sm font-medium text-gray-700">End date & time</span>
                <input
                    type="datetime-local"
                    value={state.endsAt}
                    onChange={(e) => state.setEndsAt(e.target.value)}
                    className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-blue-500"
                />
                {errors.endsAt ? <span className="mt-1 block text-xs text-red-600">{errors.endsAt}</span> : <span className="mt-1 block text-xs text-gray-500">Leave empty for no end date</span>}
            </label>
        </div>
    );
}