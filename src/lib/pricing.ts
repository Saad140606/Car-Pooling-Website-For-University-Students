export type TransportType = 'car' | 'bike';

export type PricingInputs = {
  transportType: TransportType;
  distanceKm: number; // kilometers
  durationMinutes: number; // minutes
  departureTime?: string | Date | null; // optional ISO or Date
  petrolPrice?: number; // PKR per litre (optional override)
  timeRatePerHour?: number; // PKR per hour (optional override)
  earningMarginMultiplier?: number; // multiplier like 1.15 (optional override)
};

export type PricingBreakdown = {
  fuelCost: number;
  timeCost: number;
  dynamicMultiplier: number;
  earningMarginMultiplier: number;
  baseCost: number;
  adjustedCost: number;
  totalCost: number;
  perSeatDivisor: number;
};

export type PricingResult = {
  recommendedPerSeat: number;
  finalPerSeat: number;
  breakdown: PricingBreakdown;
};

// Defaults (can be overridden by env or caller)
const DEFAULT_PETROL_PRICE = typeof process !== 'undefined' && process.env && process.env.NEXT_PUBLIC_PETROL_PRICE ? Number(process.env.NEXT_PUBLIC_PETROL_PRICE) : 255;
const DEFAULT_TIME_RATE = typeof process !== 'undefined' && process.env && process.env.NEXT_PUBLIC_TIME_RATE ? Number(process.env.NEXT_PUBLIC_TIME_RATE) : 150; // PKR per hour
const DEFAULT_EARNING_MARGIN = 1.15; // 15%

const CAR_MILEAGE = 12; // km per litre
const BIKE_MILEAGE = 35; // km per litre

function getFuelCostPerKm(transport: TransportType, petrolPrice: number) {
  if (transport === 'car') return petrolPrice / CAR_MILEAGE;
  return petrolPrice / BIKE_MILEAGE;
}

function computeDynamicMultiplier(departure?: string | Date | null) {
  const now = departure ? (departure instanceof Date ? departure : new Date(String(departure))) : new Date();
  const hour = now.getHours();
  const day = now.getDay(); // 0 = Sunday, 6 = Saturday
  let mult = 1.0;
  // Peak hours: 8–11 AM, 5–9 PM
  if ((hour >= 8 && hour < 11) || (hour >= 17 && hour < 21)) mult = 1.15;
  // Late night after 10 PM
  if (hour >= 22) mult = 1.2;
  // Weekend multiplier
  if (day === 0 || day === 6) mult = +(mult * 1.1).toFixed(3);
  return mult;
}

export function calculatePricing(inputs: PricingInputs): PricingResult {
  const petrolPrice = inputs.petrolPrice ?? DEFAULT_PETROL_PRICE;
  const timeRate = inputs.timeRatePerHour ?? DEFAULT_TIME_RATE;
  const earningMarginMultiplier = inputs.earningMarginMultiplier ?? DEFAULT_EARNING_MARGIN;

  const fuelPerKm = getFuelCostPerKm(inputs.transportType, petrolPrice);
  const totalFuelCost = +(inputs.distanceKm * fuelPerKm);
  const timeCost = +((inputs.durationMinutes / 60) * timeRate);
  const baseCost = +(totalFuelCost + timeCost);
  const dynamicMultiplier = computeDynamicMultiplier(inputs.departureTime);
  const adjustedCost = +(baseCost * dynamicMultiplier);
  const totalCost = +(adjustedCost * earningMarginMultiplier);
  const perSeatDivisor = inputs.transportType === 'car' ? 4 : 2;
  const recommendedPerSeat = +(totalCost / perSeatDivisor);

  const breakdown: PricingBreakdown = {
    fuelCost: +totalFuelCost,
    timeCost: +timeCost,
    dynamicMultiplier: +dynamicMultiplier,
    earningMarginMultiplier: +earningMarginMultiplier,
    baseCost: +baseCost,
    adjustedCost: +adjustedCost,
    totalCost: +totalCost,
    perSeatDivisor,
  };

  return {
    recommendedPerSeat: +Number(recommendedPerSeat.toFixed(2)),
    finalPerSeat: +Number(recommendedPerSeat.toFixed(2)),
    breakdown,
  };
}

export function clampAdjustedPrice(recommended: number, candidate: number) {
  const min = +(recommended * 0.8);
  const max = +(recommended * 1.3);
  const clamped = Math.max(min, Math.min(max, candidate));
  return { clamped: +Number(clamped.toFixed(2)), min: +Number(min.toFixed(2)), max: +Number(max.toFixed(2)) };
}

export default {
  calculatePricing,
  clampAdjustedPrice,
};
