// Svenskt ränteavdrag och amorteringshjälpare — delas av amorteringssimulatorn
// (ExtraAmortizationSimulator) och hälsoförslagen (financial-health) så att samma
// ränta-efter-skatt räknas på båda ställena och talen aldrig glider isär.

/** Ränteavdragets brytpunkt per låntagare och år (Skatteverket): 30 % upp till detta, 21 % däröver. */
export const DEDUCTION_THRESHOLD_PER_BORROWER = 100_000;

/**
 * Andel av räntan som ränteavdraget täcker, givet årlig räntekostnad och antal låntagare.
 * Tröskeln är per person — ett gemensamt par-lån har alltså i praktiken dubbel 30 %-tröskel.
 */
export function taxDeductionFactor(annualInterest: number, borrowers = 1): number {
  if (annualInterest <= 0) return 0;
  const threshold = DEDUCTION_THRESHOLD_PER_BORROWER * Math.max(1, borrowers);
  if (annualInterest <= threshold) return 0.3;
  return (threshold * 0.3 + (annualInterest - threshold) * 0.21) / annualInterest;
}

/** Effektiv årsränta efter ränteavdrag för ett givet saldo. applyTax=false ⇒ nominell ränta. */
export function effectiveAnnualRate(
  balance: number,
  annualRatePct: number,
  applyTax: boolean,
  borrowers = 1,
): number {
  if (!applyTax) return annualRatePct;
  const annualInterest = balance * (annualRatePct / 100);
  return annualRatePct * (1 - taxDeductionFactor(annualInterest, borrowers));
}

/**
 * Antal låntagare för ett lån: ett gemensamt lån (ownerId null/undefined) delas av alla
 * vuxna i hushållet, ett personligt lån har en. Styr ränteavdragets tröskel.
 */
export function borrowersForLoan(ownerId: string | null | undefined, householdAdults: number): number {
  return ownerId == null ? Math.max(1, householdAdults) : 1;
}
