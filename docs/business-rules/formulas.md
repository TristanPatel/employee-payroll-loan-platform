# Canonical business-logic formulas

This document is the **source of truth** for Phase 2 implementation in
`packages/shared/src/payroll/`. Every formula here was extracted from the
live Richmond Finance workbook
`Loan_CommoditiesGenerator__Settlement.xlsm` (Affordability v2.3 sheet) plus
the brief, with confirmations from operations on 2026-05-12.

All monetary values are ZMW. In code they are stored as integer ngwee
(`1 K = 100 ngwee`).

## 1 — Statutory deductions

### 1.1 PAYE (Pay As You Earn)

Marginal bands seeded from the xlsm and editable by master_admin in
`tax_settings`. The PAYE base is `gross − NAPSA` (the xlsm computes from
`F7 = gross − 4500` then collapses up the brackets, which is mathematically
equivalent to the marginal-band table below for the same inputs).

| Monthly band (ZMW) | Marginal rate |
|---|---|
| 0 – 4,500 | 0% (tax-free threshold) |
| 4,501 – 4,800 | 25% |
| 4,801 – 6,900 | 30% |
| > 6,900 | 37.5% |

```
PAYE(base) =
  0                                    if base ≤ 4500
+ min(base − 4500, 300)   × 0.25
+ min(max(base − 4800, 0), 2100) × 0.30
+ max(base − 6900, 0)     × 0.375
```

### 1.2 NAPSA

5% of **basic** pay, capped at the monthly statutory ceiling
(K1,540.20 for 2025/2026 = 5% × K30,804). Cap is stored in `tax_settings`.

```
NAPSA = min(basic × 0.05, ceiling)
```

### 1.3 NHIMA

1% of **basic** pay, uncapped. Confirmed by operations on 2026-05-12 — note
that this diverges from the brief (which said "gross") in favour of the
xlsm and the operational reality.

```
NHIMA = basic × 0.01
```

## 2 — Affordability

```
netAfterStatutory     = gross − (PAYE + NAPSA + NHIMA + pension + union + other)
takeHomeRetained      = netAfterStatutory × 0.70
availableForObligs    = netAfterStatutory × 0.30   ← cap on TOTAL obligations
maxRichmondDeduction  = availableForObligs − existingObligations
maxLoanPrincipal      = (tenureMonths × maxRichmondDeduction)
                        / (1 + monthlyRate × tenureMonths)
debtRatio             = (existingObligations + newRepayment) / netAfterStatutory
passes                = debtRatio ≤ employer.maxDebtRatioPct
```

Defaults:

- `employer.maxDebtRatioPct = 0.30` (Choppies overrides to 0.35).
- `existingObligations` covers insurance, salary advances, other-bank loans,
  microfinance loans, employer salary advances — explicitly per the xlsm
  rows D29–D34.

## 3 — Loan economics (straight-line)

Per-employer rates and fees are configured at onboarding by master_admin:

```
totalInterest      = principal × monthlyRate × tenureMonths
totalCollectable   = principal + totalInterest
monthlyInstallment = totalCollectable / tenureMonths
```

Common Richmond settings:

| Employer | monthlyRate | adminFeePct | insuranceFeePct |
|---|---|---|---|
| Sino Metals (Cat 1) | 4.00% | 2.00% | 2.00% |
| Settlement / top-up (Cat 2) | 2.25% | 2.00% | 2.00% |

The category-1 vs category-2 split (4% vs 2.25%) is set per employer at
onboarding, not derived from loan amount.

## 4 — Fees (one-off, deducted upfront)

```
adminFee     = principal × employer.adminFeePct        (default 2%)
insuranceFee = principal × employer.insuranceFeePct    (default 2%)
disbursed    = principal − adminFee − insuranceFee − settlementPaid
```

Both fees are **flat one-off charges**, confirmed by operations on
2026-05-12 (overriding the tenure-tiered model that appeared in the legacy
xlsm).

## 5 — Repayment schedule

For instalment `N` in `1..tenureMonths`:

```
dueDate            = startDate + N months, aligned to employer.payrollRunDay
scheduledAmount    = monthlyInstallment
principalShare     = principal / tenureMonths
interestShare      = totalInterest / tenureMonths
```

The final instalment carries any sub-ngwee residue so totals reconcile
exactly to `totalCollectable`.

## 6 — Settlement / top-up

Mirrors the xlsm Settlement Calculator sheet (rows 14–17):

```
recomputedTotalCollectable = principal × (1 + monthlyRate × tenureMonths)
collectedSoFar             = Σ repayments through asOfDate
graceInstalmentsToCollect  = remaining grace-period instalments (typically 1)
settlementAmount           = recomputedTotalCollectable
                             − collectedSoFar
                             − graceInstalmentsToCollect × monthlyInstallment
```

Settlement quotes are valid for ~30 days (`employer.settlementQuoteValidityDays`).

## 7 — Approval tiers

| Tier | Requested amount | Approvers required |
|---|---|---|
| **L1** | ≤ K5,000 | CSE + approver_l1 |
| **L2** | K5,001 – K10,000 | approver_l1 + approver_l2 |
| **L3** | > K10,000 | approver_l1 + approver_l2 + master_admin (or CFO) |

Disbursement always requires Accounts + CFO sign-off regardless of tier.

## 8 — Identifiers

- **Loan / application number**: `RFL{branchCode}{seq6}` where
  `branchCode ∈ {LS, KT, ND, …}` (2 chars) and `seq6` is a 6-digit
  zero-padded Postgres SEQUENCE per branch.
- **Pre-approval form serial**: `RFS{seq7}` allocated by a separate
  Postgres SEQUENCE.
- The legacy xlsm used a 4-digit hardcoded branch token (e.g. `4624` for
  Kitwe). We preserve the old number on `loans.legacy_loan_no` for
  reconciliation with paper files.

## 9 — Salary advance (Section 13 of the brief)

A short-term product distinct from the payroll loan:

- Maximum tenure: 3 months.
- No insurance fee.
- No L2 / CFO approval — CSE + approver_l1 only.
- Other rules (PAYE, NAPSA, NHIMA, affordability, schedule) are identical.

## Source documents

- `Loan_CommoditiesGenerator__Settlement.xlsm` (Affordability v2.3,
  Entry Sheet, Settlement Calculator, Contract Part A v3.0)
- `DUE_DILIGENCE_PAYROLL_CHECKLIST_v1.3.pdf`
- `Employee_Loan_Scheme_Procedure_June_2025_v1.1.pdf`
- `Richmond_Finance_Limited_Employee_Procedure_Handbook_2025.docx`
- `PreApproval_Form_SINO.pdf`
- Operations confirmations on 2026-05-12 (in this session)
