export interface GlossaryEntry {
  id: string
  title: string
  definition: string
}

/**
 * Plain-English definitions for every financial and operational term shown
 * as a label in the interface — written for a school owner, not an
 * accountant. Two or three sentences each, with a worked example where it
 * helps a figure click. This is the static, always-available layer; the
 * AI explanation panel (see components/glossary) adds a second layer on
 * top that speaks to the figure in this specific school.
 */
export const GLOSSARY_TERMS: GlossaryEntry[] = [
  {
    id: 'ebitda',
    title: 'EBITDA',
    definition:
      "Earnings before interest, tax, depreciation and amortisation — what the school makes from running day to day, before financing costs and the accounting write-down of buildings and equipment. It's the cleanest read of operating performance, since two schools with the same EBITDA but different loans or capital spending can still be compared fairly on it.",
  },
  {
    id: 'ebit',
    title: 'EBIT',
    definition:
      'Earnings before interest and tax — EBITDA minus depreciation. This is closer to true profit than EBITDA because it accounts for buildings and equipment wearing out, but it still ignores how the school is financed (loans, equity) and tax.',
  },
  {
    id: 'net-revenue',
    title: 'Net revenue',
    definition:
      'Gross fees actually kept after staff and scholarship discounts are deducted. For example, EGP 1,000,000 of billed tuition with a 10% average discount rate leaves EGP 900,000 of net revenue — the figure every other margin in this model is measured against.',
  },
  {
    id: 'gross-revenue',
    title: 'Gross revenue',
    definition:
      "The full billed value of every fee category — tuition, registration, transport and so on — before any discount is applied. It's the starting point for net revenue, not the amount the school actually collects.",
  },
  {
    id: 'depreciation',
    title: 'Depreciation',
    definition:
      'The accounting charge that spreads the cost of a building, bus or IT system across the years it is used, rather than expensing it all in the year of purchase. A EGP 5,000,000 fit-out with a 5-year useful life shows as EGP 1,000,000 of depreciation each year, even though the cash actually left the bank in year one.',
  },
  {
    id: 'amortisation',
    title: 'Amortisation',
    definition:
      'The same idea as depreciation, but for intangible assets — software licences, franchise fees, curriculum rights — rather than physical ones. This model treats every capital item the same way (straight line, spread over its useful life), so amortisation and depreciation behave identically here.',
  },
  {
    id: 'profit-before-tax',
    title: 'Profit before tax',
    definition:
      'EBIT minus interest and loan arrangement fees — what the school earned before the tax authority takes its share. This is the true bottom-line profitability once financing costs are included, which EBIT and EBITDA both leave out.',
  },
  {
    id: 'net-profit',
    title: 'Net profit',
    definition:
      "Profit before tax minus tax — the amount left over that belongs to the school's owners, either kept in the business as retained earnings or paid out as a dividend.",
  },
  {
    id: 'ebitda-margin',
    title: 'EBITDA margin',
    definition:
      'EBITDA expressed as a percentage of net revenue, so schools of different sizes can be compared on operating efficiency. An EBITDA margin of 30% means EGP 30 of every EGP 100 of net revenue is kept before financing costs, depreciation and tax.',
  },
  {
    id: 'net-margin',
    title: 'Net margin',
    definition:
      'Net profit as a percentage of net revenue — the true bottom-line profitability after every cost, including interest and tax, is accounted for.',
  },
  {
    id: 'cash-flow',
    title: 'Cash flow',
    definition:
      "The actual movement of money in and out of the bank account, as opposed to accounting profit. A school can be profitable on paper (net profit positive) while still running short of cash, because fees are collected over the year while salaries are paid monthly — cash flow is what tells you if there's enough in the bank to cover payroll.",
  },
  {
    id: 'closing-cash',
    title: 'Closing cash',
    definition:
      "The bank balance at the end of a forecast year, carried forward as the opening balance for the next. It's the single number that answers "
      + '"does the school run out of money" — a closing cash figure below zero means funding is needed before that point.',
  },
  {
    id: 'cash-low-point',
    title: 'Cash low point',
    definition:
      'The lowest closing cash balance reached across the whole forecast period, whichever year it falls in. This is the moment the school is most exposed, and it drives how much funding needs to be lined up in advance.',
  },
  {
    id: 'peak-funding-requirement',
    title: 'Peak funding requirement',
    definition:
      'How much external funding — equity or a loan — would be needed to keep the cash low point at zero rather than negative. If the cash low point is EGP (2,000,000), the peak funding requirement is EGP 2,000,000: that is the minimum a founder needs to have lined up.',
  },
  {
    id: 'break-even-year',
    title: 'Break-even year',
    definition:
      'The first forecast year in which net profit turns positive and stays there. Before this year the school is still operating at a loss overall, even if individual months or terms are profitable.',
  },
  {
    id: 'working-capital',
    title: 'Working capital',
    definition:
      "The gap between what's owed to the school (receivables) and what the school owes its suppliers (payables). Rising working capital ties up cash even when the business is profitable, because revenue has been earned on paper but not yet collected.",
  },
  {
    id: 'receivables',
    title: 'Receivables',
    definition:
      "Fees that have been billed and counted as revenue but not yet collected in cash — typically because a family pays termly rather than up front. It's an asset on the balance sheet, but it isn't cash in the bank yet.",
  },
  {
    id: 'payables',
    title: 'Payables',
    definition:
      "Costs the school has incurred — salaries, supplier invoices — but hasn't paid out in cash yet, usually because of standard supplier credit terms. It's a short-term liability that delays a cash outflow without changing the expense itself.",
  },
  {
    id: 'days-sales-outstanding',
    title: 'Days sales outstanding',
    definition:
      'How many days, on average, it takes to collect cash after fees are billed. A figure of 30 days means a family that owes fees today typically pays, on average, a month later — the longer this is, the more cash sits in receivables rather than the bank.',
  },
  {
    id: 'bad-debt',
    title: 'Bad debt',
    definition:
      'The share of billed fees the school expects never to collect at all — families who leave without paying a final term, for example. This is written off rather than merely delayed, unlike days sales outstanding which is just a timing gap.',
  },
  {
    id: 'capital-expenditure',
    title: 'Capital expenditure',
    definition:
      "Spending on assets that last more than one year — buildings, buses, IT infrastructure — as opposed to day-to-day operating costs. It's recorded on the balance sheet and depreciated over its useful life rather than expensed immediately, even though the cash usually leaves in one lump sum.",
  },
  {
    id: 'useful-life',
    title: 'Useful life',
    definition:
      'How many years an asset is expected to remain in service before it needs replacing — this is the period its cost is depreciated across. A school bus with a 5-year useful life spreads its cost over 5 years of depreciation, whatever its actual resale value later.',
  },
  {
    id: 'straight-line-depreciation',
    title: 'Straight line depreciation',
    definition:
      "The simplest way to spread an asset's cost: an equal amount every year of its useful life. A EGP 500,000 asset with a 5-year useful life depreciates by exactly EGP 100,000 a year — this is the only method this model uses.",
  },
  {
    id: 'enterprise-value',
    title: 'Enterprise value',
    definition:
      "What the whole operating business is worth, independent of how it's financed — the present value of everything it's expected to generate in future cash flow, plus a terminal value for everything beyond the forecast. It doesn't yet account for the school's debt or cash balance.",
  },
  {
    id: 'equity-value',
    title: 'Equity value',
    definition:
      "What the school's owners' stake is actually worth — enterprise value minus net debt. This is the number that matters to a founder or investor selling their shares, since it already accounts for what would need to be paid off first.",
  },
  {
    id: 'net-debt',
    title: 'Net debt',
    definition:
      'Total loan balances outstanding minus cash on hand. A negative net debt means the school holds more cash than it owes — effectively net cash rather than net debt.',
  },
  {
    id: 'npv',
    title: 'NPV',
    definition:
      "Net present value — the value today of a stream of future cash flows, once discounted back to account for the fact that money in the future is worth less than money now. A positive NPV means the investment is expected to create more value than it costs, at the discount rate used.",
  },
  {
    id: 'irr',
    title: 'IRR',
    definition:
      "Internal rate of return — the annual growth rate the investment effectively delivers, given its upfront cost and its future cash flows. An IRR of 20% roughly means the money put in compounds at 20% a year; comparing it to the discount rate tells you whether the investment clears your hurdle. It shows as \"n/a\" when the cash flows never cross zero, so no single rate solves the equation.",
  },
  {
    id: 'wacc',
    title: 'WACC',
    definition:
      "Weighted average cost of capital — the blended return that equity and debt investors both require, weighted by how much of each funds the business. This model uses the discount rate you set directly, in place of computing WACC from a specific debt and equity mix.",
  },
  {
    id: 'discount-rate',
    title: 'Discount rate',
    definition:
      'The annual percentage used to shrink future cash flows down to what they are worth today, reflecting risk and the time value of money. A higher discount rate means the valuation trusts distant cash flows less and weights near-term ones more heavily.',
  },
  {
    id: 'terminal-value',
    title: 'Terminal value',
    definition:
      "The value of every cash flow beyond the last year of the forecast, condensed into a single figure at that final year. It usually makes up most of a valuation, since a forecast can only run a handful of years but a school is expected to keep operating well beyond it.",
  },
  {
    id: 'terminal-growth',
    title: 'Terminal growth',
    definition:
      "The rate cash flow is assumed to keep growing at forever, beyond the forecast horizon, used to calculate terminal value under the perpetuity method. It must stay below the discount rate — a business that's assumed to grow faster than money is discounted has no finite value.",
  },
  {
    id: 'exit-multiple',
    title: 'Exit multiple',
    definition:
      "An alternative way to estimate terminal value: instead of a growth assumption, it applies a multiple (e.g. 8x) to the final year's EBITDA, based on what similar schools have sold for. An 8x multiple on EGP 5,000,000 of EBITDA gives a EGP 40,000,000 terminal value.",
  },
  {
    id: 'payback-period',
    title: 'Payback period',
    definition:
      "The forecast year in which cumulative free cash flow turns positive — the point the initial investment has been fully recovered in cash terms. It doesn't account for the time value of money the way NPV does, but it's an intuitive check on how long capital is at risk.",
  },
  {
    id: 'free-cash-flow',
    title: 'Free cash flow',
    definition:
      'Cash generated by operations after tax and capital expenditure, before any financing activity like loan repayments or dividends. This is the figure valuations are built on, since it represents cash genuinely available to whoever is entitled to it.',
  },
  {
    id: 'gearing',
    title: 'Gearing',
    definition:
      "How much of the school's funding comes from debt rather than equity — a highly geared school has borrowed heavily relative to what its owners have put in. Higher gearing amplifies both returns and risk, since interest and repayments are fixed regardless of how the school performs.",
  },
  {
    id: 'interest-cover',
    title: 'Interest cover',
    definition:
      "How many times over EBIT could pay the year's interest bill — a common lender test of whether a loan is safely affordable. An interest cover of 5x means EBIT is five times the interest due; below roughly 2x, most lenders would consider the debt load risky.",
  },
  {
    id: 'annuity',
    title: 'Annuity (repayment)',
    definition:
      "A repayment schedule where the total payment (interest plus principal) stays the same every year, similar to a standard mortgage — early payments are mostly interest, later ones mostly principal. This is the most common way school loans are structured, since the fixed instalment is easy to budget against.",
  },
  {
    id: 'bullet-repayment',
    title: 'Bullet repayment',
    definition:
      "A loan structure where only interest is paid each year, with the entire principal repaid in one lump sum at the end of the term. This keeps annual payments low during the loan's life, but it concentrates a large cash outflow into a single year.",
  },
  {
    id: 'grace-period',
    title: 'Grace period',
    definition:
      'Years at the start of a loan during which no principal repayment is due — interest still accrues, but the balance does not start reducing until the grace period ends. This gives a new school breathing room before repayments begin while it is still ramping up enrolment.',
  },
  {
    id: 'arrangement-fee',
    title: 'Arrangement fee',
    definition:
      'A one-off charge a lender takes for setting up a loan, usually a percentage of the amount drawn down. A 2% arrangement fee on a EGP 5,000,000 drawdown costs EGP 100,000, on top of the interest paid over the life of the loan.',
  },
  {
    id: 'share-capital',
    title: 'Share capital',
    definition:
      "Money the owners have put into the business in exchange for shares, rather than lent to it. It's the equity foundation the school is built on, and it should normally fund the opening cash and any fixed assets already on the books before year one.",
  },
  {
    id: 'retained-earnings',
    title: 'Retained earnings',
    definition:
      "The running total of net profit the school has kept rather than paid out as dividends, accumulated year over year. It grows the owners' equity in the business without needing any new share capital to be injected.",
  },
  {
    id: 'dividend-payout',
    title: 'Dividend payout',
    definition:
      "The share of net profit distributed to the school's owners in cash, rather than retained in the business. A 30% payout on EGP 1,000,000 of net profit pays EGP 300,000 to owners and keeps EGP 700,000 as retained earnings.",
  },
  {
    id: 'occupancy',
    title: 'Occupancy',
    definition:
      "What percentage of available classroom capacity is actually filled with students. 80% occupancy in a year group with a ceiling of 100 students means 80 students are enrolled — occupancy is what drives revenue up to that ceiling.",
  },
  {
    id: 'capacity-ceiling',
    title: 'Capacity ceiling',
    definition:
      'The maximum number of students a year group can physically hold, based on classrooms times students per classroom (or a manually set hard cap). Occupancy can never push enrolment above this number, however strong demand is.',
  },
  {
    id: 'student-teacher-ratio',
    title: 'Student to teacher ratio',
    definition:
      'How many students, on average, each teacher is responsible for. A lower ratio (fewer students per teacher) is generally associated with a premium fee positioning and a higher payroll cost per student.',
  },
  {
    id: 'cost-per-student',
    title: 'Cost per student',
    definition:
      'Total payroll, operating costs and revenue share, divided by the number of enrolled students that year. This is a useful efficiency check, and a natural figure to compare against revenue per student to see the margin per pupil.',
  },
  {
    id: 'revenue-per-student',
    title: 'Revenue per student',
    definition:
      'Net revenue divided by the number of enrolled students — the average amount each student contributes after discounts, blending every fee category and every year group together.',
  },
  {
    id: 'escalation',
    title: 'Escalation',
    definition:
      "The annual percentage increase applied to a fee or a cost, compounding year over year. A 5% escalation on a EGP 100,000 cost makes it EGP 105,000 in year two and EGP 110,250 in year three — it's how the model keeps figures realistic over a multi-year forecast rather than holding everything flat.",
  },
  {
    id: 'uptake',
    title: 'Uptake',
    definition:
      "For an optional fee category — transport or lunch, for example — the percentage of students who actually pay for it, since not everyone opts in. A transport fee with 40% uptake is only charged to 4 out of every 10 students, even though every student is offered it.",
  },
  {
    id: 'scholarship',
    title: 'Scholarship',
    definition:
      'A discount awarded to a fixed number of student places — typically used for merit, need or strategic enrolment goals. Each scholarship place reduces net revenue but can still help fill capacity that would otherwise sit empty.',
  },
  {
    id: 'revenue-share',
    title: 'Revenue share (STM)',
    definition:
      "A percentage of revenue paid to a third-party school management or franchise partner (an STM agreement), either as a flat rate or in tiered bands. It's calculated on whichever revenue base the agreement specifies — gross revenue, net revenue, or cash actually collected.",
  },
  {
    id: 'corporate-tax',
    title: 'Corporate tax',
    definition:
      "The percentage of taxable profit paid to the government. This model applies it to profit before tax, after interest and arrangement fees have already been deducted — a school with a loss can carry that loss forward to reduce tax in a future profitable year, if that option is enabled.",
  },
  {
    id: 'carry-losses-forward',
    title: 'Carry losses forward',
    definition:
      "An accounting rule that lets a loss made in one year offset taxable profit in a later year, rather than that year's loss simply being ignored for tax purposes. A school that loses EGP 500,000 in year one and makes EGP 500,000 in year two would pay no tax in year two if this is enabled.",
  },
  {
    id: 'payables-days',
    title: 'Payables days',
    definition:
      'How many days of credit the school takes on its operating costs before paying suppliers — the mirror image of days sales outstanding, but for what the school owes rather than what it is owed.',
  },
  {
    id: 'total-assets',
    title: 'Total assets',
    definition:
      'Everything the school owns that has value — cash, money owed to it, and fixed assets like buildings and equipment, net of depreciation. On the balance sheet this must always equal total liabilities plus total equity.',
  },
  {
    id: 'total-liabilities',
    title: 'Total liabilities',
    definition:
      "Everything the school owes to others — outstanding loan balances and unpaid supplier costs (payables). It's funded by a combination of debt the school has taken on and credit its suppliers have extended.",
  },
  {
    id: 'total-equity',
    title: 'Total equity',
    definition:
      "The owners' stake in the school on the balance sheet — share capital plus retained earnings. It represents what would be left for the owners if every asset were sold and every liability paid off.",
  },
  {
    id: 'balance-check',
    title: 'Balance check',
    definition:
      "A control row that should always read zero: total assets minus total liabilities minus total equity. If it isn't zero, the balance sheet doesn't tie — that's a signal something in the model's inputs is inconsistent, not a figure to plan against.",
  },
  {
    id: 'peak-debt',
    title: 'Peak debt',
    definition:
      'The highest outstanding loan balance reached across every loan and every forecast year. This is the largest amount the school will owe lenders at any one point, even if individual loans are drawn down or repaid at different times.',
  },
  {
    id: 'minimum-cash',
    title: 'Minimum cash',
    definition:
      "The lowest closing cash balance across the forecast once financing activity — loan drawdowns, repayments, equity injections and dividends — is included. It's the financing-aware equivalent of the cash low point, and the more complete figure once loans and equity are part of the plan.",
  },
  {
    id: 'total-interest',
    title: 'Total interest',
    definition:
      'The sum of every interest payment across every loan and every forecast year. This is the true cost of borrowing over the life of the debt, separate from the principal that eventually gets repaid.',
  },
  {
    id: 'compound-annual-growth-rate',
    title: 'Compound annual growth rate (CAGR)',
    definition:
      'The single steady annual growth rate that would take net revenue from its year-one figure to its final-year figure, smoothing out any year-to-year unevenness. It is a convenient one-number summary of growth, not a claim that growth was actually even every year.',
  },
]

export const GLOSSARY: Record<string, GlossaryEntry> = Object.fromEntries(
  GLOSSARY_TERMS.map((entry) => [entry.id, entry]),
)

export function getGlossaryEntry(id: string): GlossaryEntry | undefined {
  return GLOSSARY[id]
}
