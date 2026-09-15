import { Category } from '@prisma/client'
import { categoryLabels } from '@/lib/utils/categories'
import {
  CoverageDayStatus,
  PULSE_THRESHOLDS,
  PulseCoverageDay,
  PulseResponse,
  getOtherShareLevel,
} from '@/lib/utils/pulse'

const CATEGORY_ORDER = Object.keys(categoryLabels) as Category[]
const CATEGORY_COUNT = CATEGORY_ORDER.length

const TOTAL_CELL_CLASSES: Record<CoverageDayStatus, string> = {
  empty: 'bg-red-100 text-red-800',
  thin: 'bg-amber-100 text-amber-800',
  ok: 'bg-green-50 text-green-800',
}

const CHIP_CLASSES = {
  neutral: 'bg-stone-100 text-stone-700',
  ok: 'bg-green-100 text-green-800',
  warn: 'bg-amber-100 text-amber-800',
  bad: 'bg-red-100 text-red-800',
}

const LABEL_CELL = 'sticky left-0 z-10 bg-white px-3 py-1.5 text-left whitespace-nowrap border-r border-stone-200'
const COUNT_CELL = 'px-2 py-1.5 text-center tabular-nums min-w-[2.75rem]'

function isWeekend(day: PulseCoverageDay) {
  return day.weekday === 'Sat' || day.weekday === 'Sun'
}

function monthDay(date: string) {
  const [, month, day] = date.split('-')
  return `${Number(month)}/${Number(day)}`
}

function publicDayHref(day: PulseCoverageDay) {
  const params = new URLSearchParams({ date: 'custom', customStart: day.startUtc, customEnd: day.endUtc })
  return `/?${params}`
}

export default function CoverageGrid({ coverage }: { coverage: PulseResponse['coverage'] }) {
  const { days, categoriesWithEventsThisWeek, otherShare } = coverage
  const thinDays = days.filter((d) => d.status === 'thin').length
  const emptyDays = days.filter((d) => d.status === 'empty').length

  const countRow = (label: string, getCount: (day: PulseCoverageDay) => number, extraClass = '') => (
    <tr key={label} className={extraClass}>
      <th scope="row" className={`${LABEL_CELL} font-normal text-stone-700`}>{label}</th>
      {days.map((day, i) => {
        const count = getCount(day)
        return (
          <td key={day.date} className={`${COUNT_CELL} text-stone-700 ${i === 0 ? 'bg-orange-50/60' : ''}`}>
            {count > 0 ? count : ''}
          </td>
        )
      })}
    </tr>
  )

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-3 text-sm">
        <Chip tone={thinDays > 0 ? 'warn' : 'ok'}>
          {thinDays} thin day{thinDays === 1 ? '' : 's'} (&lt; {PULSE_THRESHOLDS.thinDayEvents})
        </Chip>
        <Chip tone={emptyDays > 0 ? 'bad' : 'ok'}>
          {emptyDays} empty day{emptyDays === 1 ? '' : 's'}
        </Chip>
        <Chip tone="neutral">
          Categories this week: {categoriesWithEventsThisWeek} of {CATEGORY_COUNT}
        </Chip>
        <Chip tone={getOtherShareLevel(otherShare)}>Other: {Math.round(otherShare * 100)}%</Chip>
      </div>

      <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm border-separate border-spacing-0">
            <thead>
              <tr>
                <th scope="col" className={`${LABEL_CELL} bg-stone-50 border-b font-medium text-stone-600`}>
                  Category
                </th>
                {days.map((day, i) => {
                  const headerBg = i === 0 ? 'bg-orange-100 text-orange-800' : isWeekend(day) ? 'bg-stone-200/70 text-stone-700' : 'bg-stone-50 text-stone-600'
                  return (
                    <th key={day.date} scope="col" className={`p-0 border-b border-stone-200 font-medium ${headerBg}`}>
                      <a
                        href={publicDayHref(day)}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={`Open ${day.date} on the public site`}
                        className="block px-2 py-2 text-center leading-tight hover:underline"
                      >
                        <span className="block">{i === 0 ? 'Today' : day.weekday}</span>
                        <span className="block text-xs font-normal">{monthDay(day.date)}</span>
                      </a>
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row" className={`${LABEL_CELL} font-semibold text-stone-900 border-b`}>Total</th>
                {days.map((day) => (
                  <td
                    key={day.date}
                    title={day.status}
                    className={`${COUNT_CELL} font-semibold border-b border-stone-200 ${TOTAL_CELL_CLASSES[day.status]}`}
                  >
                    {day.total}
                  </td>
                ))}
              </tr>
              {CATEGORY_ORDER.map((category) => countRow(categoryLabels[category], (day) => day.byCategory[category]))}
              {countRow('Family-friendly', (day) => day.familyFriendly, '[&>*]:border-t [&>*]:border-stone-200')}
              {countRow('Free', (day) => day.free)}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function Chip({ tone, children }: { tone: keyof typeof CHIP_CLASSES; children: React.ReactNode }) {
  return <span className={`px-2.5 py-1 rounded-full font-medium ${CHIP_CLASSES[tone]}`}>{children}</span>
}
