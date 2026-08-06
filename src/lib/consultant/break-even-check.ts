import type { CostModel } from '@/domain/costs'
import type { Project } from '@/domain/schema'
import { FEE_POSITIONING_LABELS, type FeePositioning } from '@/lib/egp-fee-bands'
import { buildCandidateForecast } from './build-candidate'
import type { ConsultantModelResponse } from './route-contract'

const BAND_ORDER: FeePositioning[] = ['budget', 'midMarket', 'premium', 'luxury']

function nextBandUp(positioning: FeePositioning): FeePositioning | null {
  const index = BAND_ORDER.indexOf(positioning)
  if (index === -1 || index === BAND_ORDER.length - 1) return null
  return BAND_ORDER[index + 1] ?? null
}

/**
 * Server-side feasibility backstop: if the model proposed a feePositioning
 * but did not itself flag a break-even conflict, build a candidate forecast
 * in memory and check breakEvenYearIndex ourselves. Never trusts the model
 * to have run the engine. Only adds a warning/alternative when the model's
 * own response left both empty — never overrides a warning the model gave.
 */
export function checkBreakEven(
  project: Project,
  costModel: CostModel,
  response: ConsultantModelResponse,
): ConsultantModelResponse {
  if (!response.patch?.feePositioning) return response
  if (response.breakEvenWarning || response.alternatives) return response

  let forecast
  try {
    forecast = buildCandidateForecast(project, costModel, response.patch)
  } catch {
    return response
  }

  if (forecast.breakEvenYearIndex !== null) return response

  const positioning = response.patch.feePositioning
  const alternativePositioning = nextBandUp(positioning)

  const breakEvenWarning = `At ${FEE_POSITIONING_LABELS[positioning]} positioning, this school does not break even within the ${project.calendar.forecastYears}-year forecast.`

  if (!alternativePositioning) {
    return {
      ...response,
      breakEvenWarning: `${breakEvenWarning} It is already at the highest fee band — consider reducing the target capacity or capital budget instead.`,
    }
  }

  return {
    ...response,
    breakEvenWarning,
    alternatives: [
      {
        label: `${FEE_POSITIONING_LABELS[alternativePositioning]} positioning`,
        tradeoff: `Moves fees up one band, from ${FEE_POSITIONING_LABELS[positioning]} to ${FEE_POSITIONING_LABELS[alternativePositioning]}, to reach break-even within the forecast — at the cost of a less competitive fee position for the market.`,
        patch: { ...response.patch, feePositioning: alternativePositioning },
        fieldReasons: [
          {
            path: 'feePositioning',
            label: 'Fee positioning',
            reason: `The original ${FEE_POSITIONING_LABELS[positioning]} positioning does not break even within the forecast horizon.`,
          },
        ],
      },
    ],
  }
}
