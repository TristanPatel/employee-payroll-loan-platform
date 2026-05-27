# Operational forms + contract templates

Canonical reference for the four Richmond Finance documents that drive the
end-to-end loan lifecycle. Source PDFs are not committed to the repo — they
live in a Drive share — but this document captures the field-by-field
structure each form expects, plus the resulting database fields.

## 1. Payroll Application Form

The client-facing application form. **7 sections**:

1. **Client Details** — salutation, full name (split), NRC/Passport,
   nationality, DOB, marital status, next of kin (name + contact), three
   phone numbers (mobile / home / office), email, physical + postal
   addresses, source of income, employer name + address.
2. **Loan Details** — requested amount + currency (default ZMW), amount in
   words, preferred start date, mode of payment
   (bank_transfer / standing_order / mobile_money / employer_internal).
3. **Loan Type** — `new_loan` or `refinancing`.
4. **Refinancing Only** — if refinancing, settlement method:
   `buyout` (we settle the prior loan from this principal) or
   `self_payment` (borrower clears it independently).
5. **Declarations** — AML/CTF compliance (Acts 44/2010 + 21/2007), age 18+,
   data-protection consent, indemnity against misrepresentations.
6. **Signing and Confirmation** — two authorised signatories blocks (for
   joint applications; single applicants use only block 1).
7. **Official Use Only** — Checked-by / Approved-by / Disbursed-by
   3-signature sign-off + free-text rejection reason field.

### DB mapping

Captured across:

- `profiles` — salutation, first_name, middle_name, surname, home_phone,
  office_phone, email, next_of_kin_name, next_of_kin_phone, source_of_income
- `employees` — employer_id, employee_no, residential_address,
  postal_address, employment_status
- `loan_applications` — application_type, currency, amount_in_words,
  start_date_preferred, mode_of_payment, refinancing_settlement_method,
  refinanced_from_loan_id, requested_amount_ngwee, requested_tenure_months,
  purpose, status

## 2. Payroll Closure Form

Closes a loan record. Triggered by either full settlement or employment
termination/suspension. **3 sections**:

1. **Client Details** — name, NRC, contact, employer, **employment_status**
   (`permanent` / `contract` / `temporal` / `suspension` / `terminated`).
2. **Loan Details** — requested amount, outstanding balance, loan start,
   final payment date, loan reference no.
3. **Official Use Only** — four-checkbox closure checklist:
   - Loan has been fully paid
   - All interest has been settled
   - No outstanding penalties due
   - Loan book updated to reflect closure
   ...plus 3-signature sign-off (Checked / Approved / Disbursed).

### DB mapping

New table `loan_closures` (migration 16):

```
loan_id, employment_status,
loan_fully_paid, interest_settled, no_outstanding_penalties, loan_book_updated,
checked_by/at, approved_by/at, disbursed_by/at,
closure_reason, notes
```

`employees.employment_status` is updated to match the closure form's
employment status at the same time.

## 3. Due Diligence Payroll Checklist v1.3

22-item, 5-phase checklist. See `due-diligence-checklist.md` for the
verbatim list. Captured in `due_diligence_checks` (one row per item) plus
`due_diligence_signoffs` (CSE / Branch Manager / DD Team — three rows).
Maker-checker enforced at the DB layer: CSE and Branch Manager cannot be
the same person on a given application.

## 4. Loan Agreement (Part B v1.1, now superseded by merged v1)

The legally-binding contract. Old `Part B v1.1` had 10 numbered clauses
(see source PDF). We have **merged Part B with industry-standard clauses**
into a new `loan_agreement_v1` template seeded in migration 17:

| § | Topic | Source |
|---|---|---|
| 1 | Parties | new (industry std) |
| 2 | Loan Particulars (schedule) | Part B §3 |
| 3 | Interest (straight-line, fixed) | Part B §4 |
| 4 | Fees (admin + insurance, upfront, applies to top-ups) | new + Part B §7.1 |
| 5 | Repayment + salary-deduction authorisation + payment waterfall | Part B §5 |
| 6 | Termination of employment → immediate full repayment | Part B §5.4, §10 + MOU |
| 7 | Default + breach + certificate of debt | Part B §8 |
| 8 | Borrower covenants (no bank-account closure, AML/CTF, credit-bureau) | Part B §9.2, §9.4 + new |
| 9 | Data protection (Act No. 3 of 2021) | new |
| 10 | Electronic execution (ECT Act No. 4 of 2021 + PAdES-B-T seal) | new |
| 11 | Governing law + arbitration (Lusaka, Arbitration Act No. 19 of 2000) | new |
| 12 | Entire agreement / variation / waiver / severability | Part B §9.1 + new |
| 13 | Notices | new |
| 14 | Signatures (electronic, evidence in cert. of completion) | new |

Required signatories: **borrower, employer_signatory, richmond_witness**
(in that order). The Edge Function that builds the final PDF stamps each
signature into the document and appends a Certificate of Completion with
full audit timeline (Phase 4 deliverable).

The template row is **immutable once published** — edits require a new
version number; the old version stays addressable for contracts already
sealed under it. This is enforced by trigger
`enforce_template_immutable()` on `contract_templates`.

## Registered office on every form

All four forms (and every PDF the platform generates) must carry:

```
Richmond Finance Limited
4th Floor Telecom House
Mwaimwena Road, Rhodes Park
Lusaka, Zambia

Tel: +260 965 503 484
Email: tpatel@richmond-fin.com
Web: www.richmond-afri.com

Company Registration No. 120180001942
```

This block is the canonical letterhead block used by every PDF generator
Edge Function. The PDFs we have on file at the time of writing carry the
OLD `726 Freedom Way / +260 975 344 170 / operations@richmond-fin.com`
block — **do not copy that**; always source the current block from
`docs/legal/registered-office.md`.
