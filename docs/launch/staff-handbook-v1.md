# Richmond Finance Employee Payroll Loan Portal
## Staff Handbook · Version 1.0

*[Cover page: Richmond crimson `#8b1e24` band across the top, Richmond Finance logo top-left at 48mm wide, the title in Lato Bold 24pt, the subtitle in Lato Regular 14pt, the version line in Lato Regular 10pt. Footer on every page: `Richmond Finance Limited · Confidential · v1.0 · [date]`.]*

---

## Foreword

The Employee Payroll Loan Portal is the platform our regulated lending business runs on. It exists for one purpose — to make sure every loan we issue is reviewed properly, approved by the right people, recorded faithfully, and repayable by design.

This handbook is your standing reference. It will not tell you how to be good at your job — you already are. It tells you how the portal expects you to work, and why it sometimes will not let you do things. Please keep it within reach.

**[Project Sponsor's name]**
[Title], Richmond Finance Limited

---

## About this handbook

This handbook is the official staff guide for the Richmond Finance Employee Payroll Loan Portal. It is owned by the Project Leader and reviewed at minimum once per quarter, or sooner when the portal materially changes.

**Audience:** every member of Richmond Finance staff who interacts with employee payroll loans, plus the HR and finance contacts at each employer-partner who attest payroll deductions.

**How to use it:**

1. Read **About the portal** and **Brand & sign-in** once.
2. Read **your role's section** in full. Re-read it after your first week.
3. Use **Common situations** as a desk reference.
4. Keep **Glossary** open during your first month.

**Version history**

| Version | Date | Change | Owner |
|---|---|---|---|
| 1.0 | [date] | Initial release | Project Leader |

---

## About the portal

The portal sits at **https://portal.richmond-afri.com**. It is the only place from which a Richmond Finance loan may be applied for, reviewed, approved, contracted, disbursed, or settled. It replaces all prior spreadsheets, paper application files, and ad-hoc email approvals for this product.

It is built around four guarantees, in plain language:

1. **You see only what you should.** Each screen filters its data to your role and your scope. A Branch Manager in Lusaka cannot see a Branch Manager in Kitwe's pipeline. An employer signatory at Sino Metals cannot see Choppies' applicants. This is enforced at the database, not the screen — there is no URL that bypasses it.
2. **The system knows who you are at all times.** Every action you take is recorded with your name, the time (Lusaka), the application or loan it touched, and what changed. This record is the audit trail.
3. **The workflow is rule-driven.** The portal will not let an unapproved loan be disbursed. It will not let the application-creator approve their own file. It will not let the same person approve a loan at two different tiers. These guards are not optional; they exist to protect the business and to protect you.
4. **Borrower data is regulated personal information.** Every screen treats it that way: nothing leaves the portal without a deliberate export, every export is logged, and the public verifier carries no personal data — only the integrity proof of the signed contract.

If anything you experience contradicts these four guarantees, that is a critical finding. Tell the Project Leader the same day.

---

## Brand & sign-in

The portal carries the Richmond Finance crimson `#8b1e24`, the wordmark at the top of every page, and the formal voice you would use in any client-facing communication. Every email, every notification, every contract PDF the portal generates is branded — you do not need to apply branding yourself.

### Signing in

1. Go to **https://portal.richmond-afri.com/sign-in**.
2. Enter your Richmond Finance email address.
3. Enter the temporary password issued to you by the Project Leader, **or** click **Email me a code instead** to receive a one-time code (recommended after first sign-in).
4. The portal routes you automatically to your dashboard. You do not pick.

If you ever land back on the sign-in page after entering correct credentials, capture a screenshot and tell the Project Leader. That is a Priority-0 access issue.

### Switching to OTP only

Some staff prefer to retire the password and rely on email one-time codes. From the sign-in page, you can do this for yourself after your first successful sign-in. Borrowers and employer-side users do the same. There is no penalty for keeping a password — pick what suits you.

### Signing out

There is a **Sign out** link in the header of every dashboard. If you suspect your account is compromised, use **Sign out everywhere** from your profile screen — it terminates every active session of yours, including any forgotten one on a phone or shared computer. Notify the Project Leader within the hour.

---

## Roles & responsibilities

The portal has eleven roles. Each section below tells you what your role sees, what it does, what it cannot do, and where to escalate when stuck. Read **your own section** carefully. Skim the others — knowing what your colleagues see helps you collaborate.

### Master administrator

**You see:** every screen, every loan, every employer, every staff account.

**You do:**
- Onboard new staff and employer-side users from `/admin/staff` → **Add account**.
- Re-issue temporary passwords from the row's **Manage** menu.
- Sign out a compromised account everywhere.
- Soft-delete and restore accounts.
- View the full audit history of any user from `/admin/staff/[id]`.

**You cannot:**
- Demote or deactivate your **own** master administrator account. Another master administrator must do that, so we never lose the last one.

**Escalation:** for system-wide problems — the database is unreachable, every user is bouncing back to sign-in — work with the Project Leader and the technical team in that order.

### Branch manager

**You see:** applications, loans, contracts and remittances under your branch's scope.

**You do:**
- Sign off due diligence as the branch-manager second pair of eyes.
- Approve at Tier L1 and (when policy permits) Tier L2.
- View your branch's KPI dashboard and your branch's portfolio.

**You cannot:**
- Approve your own application file (if you happen also to be a borrower at this employer scheme).
- Approve at a later tier if you have already approved at an earlier tier on the same file. This is the maker-checker rule.

**Escalation:** for a stuck file in your branch, contact the CSE on the file. For an employer not responding to attestation, contact the Project Leader.

### Customer Service Executive (CSE)

**You see:** applications in submitted / employer review / CSE review states, and the documents the borrower has uploaded.

**You do:**
- Open the application, review the borrower's documents (NRC, payslips, contract, bank proof, residence proof, photo) by clicking **Open** in the documents panel.
- Work the due-diligence checklist. Each item is `pending`, `pass`, `fail`, or `not_applicable`, with severity `critical`, `major`, or `minor`.
- Sign off as CSE when **all** critical items are `pass`. The portal blocks sign-off otherwise — that is intentional.
- Cancel and request more information from the borrower where needed.

**You cannot:**
- Approve at L1, L2 or L3. The CSE is a reviewer, not an approver.
- Sign off until criticals are cleared.

**Escalation:** for a document that does not render — confirm the borrower uploaded the right file type; if it still fails, log it as a bug. For ambiguity in a check, raise it with the Branch Manager.

### Approver L1

**You see:** applications at `l1_pending` across your authorised scope, plus the borrower and loan summary, the affordability calculation, and the due-diligence record.

**You do:**
- Approve, reject, or request more information.
- Add notes that become part of the permanent approval trail.

**You cannot:**
- Approve a file you also created (maker-checker).
- Approve at L2 or L3 on a file where you already approved at L1.

**Escalation:** if the affordability picture is inconsistent (debt ratio number does not match payslip), reject with notes and route back to the CSE.

### Approver L2

**You see:** applications at `l2_pending`. Same view as L1, with the L1 decision visible to you.

**You do:** approve, reject, or request more information at L2.

**You cannot:** approve at L1 or L3 on the same file.

**Escalation:** as Approver L1.

### Accounts

**You see:** loans at `pending_disbursement` and `active`, the bank/mobile money details, the disbursement amount, and the remittance schedule.

**You do:**
- Disburse approved loans. This moves a loan to `active`.
- Reconcile incoming repayments against the schedule.
- Manage remittance batches per employer.

**You cannot:**
- Approve at any tier.
- Disburse a loan that has not reached `pending_disbursement` (the system blocks it).

**Escalation:** for bank-file failures, contact the Project Leader and the bank desk together — do not retry blindly.

### Chief Finance Officer (CFO)

**You see:** the portfolio dashboard, every loan and application, weekly and monthly P&L, applications at `l3_pending`.

**You do:**
- Approve at Tier L3 (final approval). The portal blocks you from doing this until the employer has confirmed the payroll deduction.
- Review the P&L at `/admin/reports/pnl` for the weekly executive review.

**You cannot:**
- Approve at L1 or L2 if you have already approved at L3 on a file (or vice versa).
- Approve a file the employer has formally **declined**.

**Escalation:** if a file reaches L3 but you spot a credit concern that should have been caught earlier, reject with notes — the file routes back to the CSE.

### Auditor

**You see:** every screen, in read-only mode. Every record. The complete audit log at `/admin/activity`.

**You do:**
- Verify the audit trail for any application, loan, contract, or remittance.
- Run quarterly internal-audit walkthroughs.
- Verify segregation of duties is being respected in practice — Scenario D of the UAT plan is the kind of check you should run quarterly.

**You cannot:**
- Make any change to any record. If you find any place where you can, that is a critical finding — log it.

**Escalation:** report audit-trail gaps directly to the Managing Director, with the Project Leader copied.

### Employer administrator

**You see:** only your own employer's applications, attestations, loans and remittance status.

**You do:**
- Confirm or decline payroll-deduction attestation for your employees' loan applications.
- Maintain your employer-side user list within your scope.
- View the loans currently under salary deduction at your employer.

**You cannot:**
- See, in any form, applications or loans belonging to a different employer. The portal does not expose them, even by URL.

**Escalation:** for a declined attestation where the employee disputes the reason, route the case to Richmond's CSE on the file by email; do not unilaterally reverse.

### Employer signatory

**You see:** what an Employer Administrator sees for the employer you represent.

**You do:** the attestation step. You confirm or decline, with a written reason when declining.

**You cannot:** as Employer Administrator.

**Escalation:** as Employer Administrator.

### Borrower (Employee)

**You see:** your own application, your own loan, your own statement, your own documents.

**You do:**
- Apply for a payroll loan via your employer's apply link (e.g. `/apply/sino-metals-leach-zambia-limited`).
- Upload the required documents.
- Track the status of your application as it moves through the workflow.
- See your repayment schedule once your loan is active.
- Apply for a top-up or refinance against your existing active loan.

**You cannot:**
- See another borrower's application or loan, even within your employer.
- Approve any step.

**Escalation:** for a stuck application, use the **Get help** link on your application page; it routes you to the CSE on the file.

---

## The loan lifecycle, end to end

A typical loan moves through eleven states. The portal makes every transition explicit; nothing happens "in the background" that you cannot trace.

```
draft  →  submitted  →  cse_review  →  l1_pending  →  l2_pending  →  l3_pending  →  approved
                                  ↘                                                 ↓
                              employer_review (parallel)  →  employer_confirmed     ↓
                                                                                    ↓
                                                              pending_disbursement → active
                                                                                            ↓
                                                                                       in_arrears
                                                                                            ↓
                                                                                        settled
```

A more readable narrative:

1. **Apply.** The borrower opens their employer's apply link, signs in or signs up, fills the wizard, uploads documents, sees the calculator's affordability picture, and submits.
2. **Submitted.** The portal creates an employer-attestation request automatically. The borrower's employer is notified.
3. **CSE review.** The CSE opens the file, inspects documents, works the checklist, and signs off when criticals are passed. The Branch Manager signs off in parallel. When both have signed, the file becomes **L1 pending**.
4. **Tiered approval.** Approver L1 decides. If they approve, the file becomes **L2 pending**; if the tier requires it, Approver L2 decides; for L3-tier files, the CFO makes the final decision.
5. **Employer attestation runs in parallel.** The employer signatory or administrator confirms the employee, the basic salary, and that the deduction will be remitted. They do this on their **own** dashboard; they do not touch the credit decision.
6. **Final approval is gated.** The portal will not allow L3 approval until the employer has positively confirmed. A declined attestation freezes the file with the reason recorded.
7. **Loan created.** On final approval the portal automatically creates a `loans` record, computes admin fee, insurance fee, interest, total collectable and monthly instalment, and generates a six-row (or twelve-row, etc.) repayment schedule. Status: **pending disbursement**.
8. **Contract.** A loan-agreement contract is prepared, signed (electronic), and sealed (PAdES Baseline-T). It carries a public verifier URL printed on the document.
9. **Disburse.** Accounts marks the loan disbursed. The borrower is notified.
10. **Active.** The loan accrues interest, the schedule is collected via salary deduction, the borrower can view their statement at any time.
11. **Settled** when the schedule is fully collected.

---

## Maker-checker — why you cannot do everything

The portal enforces three rules at the database level. They cannot be turned off, and they cannot be worked around:

1. **An application's creator cannot approve it.** If you submitted a loan on behalf of a borrower, you cannot also be one of the people who approved it.
2. **The same person cannot approve at two tiers.** If you approved a file at L1, the system will refuse you at L2 or L3 — even if you also hold the role.
3. **L3 approval requires positive employer attestation.** The credit chain and the employer attestation run in parallel; both must complete affirmatively before the loan is approved.

These rules exist because the Bank of Zambia and our own internal audit require **segregation of duties** for a regulated lending business. The portal makes them mechanical rather than policy-statements you have to remember.

When the portal blocks you with a maker-checker error, it is doing its job. Tell the file to a colleague who has not yet touched it.

---

## Data protection, security, and audit

- Borrower documents (NRC, payslips, bank statements) are **personal data under Zambian law**. Treat every screen the way you would a paper file kept in a locked drawer.
- The portal serves borrower documents through short-lived signed links — they expire after ten minutes. Do not download, save, or forward these files unless your workflow specifically requires it; if you must, do so on a Richmond-issued device.
- The audit log is permanent. Every approval, sign-off, attestation, disbursement, and document view is recorded with your name and time. The Auditor and the Master Administrator can see these records on demand.
- If you suspect your account is compromised — a strange email, an unexpected sign-in confirmation, a device left on a desk — use **Sign out everywhere** from your profile screen and notify the Project Leader within the hour.

---

## Common situations

### A borrower says they applied but I cannot find them in my queue

- Confirm the borrower's email matches the one they used at sign-up.
- Confirm the borrower has actually clicked **Submit** at the end of the wizard. Drafts do not appear in your queue.
- Confirm the borrower applied to the right employer (the apply link defines this).

### The employer is silent on attestation for more than 48 hours

The system sends a reminder automatically after 24 hours. After 48 hours, contact the employer's signatory by phone and copy the Project Leader. Do **not** approve at L3; the system will block you, and it should.

### The disbursement bank file failed

Stop. Do not retry. Notify the Project Leader and the bank desk together. The loan stays at `pending_disbursement` until the underlying cause is fixed; that is correct behaviour.

### I tried to approve and the system blocked me

Read the error message carefully. The two most common are:

- *"maker-checker: cannot approve own application"* — you submitted this file; ask a colleague.
- *"role X cannot approve at tier Y"* — your role is not authorised for this tier; route to the correct approver.

Neither is a bug. If the message is genuinely unclear, log it as a clarification finding so we can improve the wording.

### A document did not render

- First, confirm with the borrower they actually uploaded that document and not a blank placeholder.
- Click **Replace** and ask the borrower to re-upload from their portal.
- If it still fails, log it as a P1 bug; include the document type and your browser.

### I see something I should not be able to see

This is the most important kind of finding. **Stop**, capture a screenshot, and tell the Project Leader immediately. This is treated as P0 regardless of how innocuous it looks.

---

## Glossary

- **Attestation** — the employer's formal confirmation that an employee is on payroll at the stated salary and that the monthly deduction will be remitted to Richmond Finance.
- **CSE** — Customer Service Executive. First-line reviewer of an application.
- **Debt ratio** — the proportion of net pay committed to debt servicing after this loan. Each employer sets a cap.
- **Disbursement** — the moment cash leaves Richmond Finance for the borrower's bank or mobile-money wallet.
- **DD** — Due diligence. The portal's twelve-item checklist (NRC validity, payslip consistency, debt-ratio fit, etc.) the CSE and Branch Manager work through before approval.
- **Maker-checker** — the principle that the person who initiates an action cannot also approve it. Hard-enforced by the portal.
- **NAPSA** — National Pension Scheme Authority statutory deduction.
- **NHIMA** — National Health Insurance Management Authority statutory deduction.
- **Ngwee** — the minor unit of the Zambian Kwacha; 100 ngwee = 1 ZMW. The portal stores money internally in ngwee.
- **NRC** — National Registration Card; Zambia's national identity document.
- **OTP** — One-time password (the six-digit code emailed to you for sign-in).
- **PAdES Baseline-T** — the contract-sealing standard the portal uses. Verifiable independently at the public verifier URL printed on each contract.
- **PAYE** — Pay As You Earn income tax.
- **RLS** — Row-Level Security; the database mechanism that decides which rows each user can see. The portal's segregation enforcer.
- **Tier** — L1, L2, or L3 — the approval depth required for a given application. Set by the affordability calculation at submission.

---

## Support & feedback

**Project Leader:** [name] · [email] · [phone] · available Monday–Friday 08:00–17:00.

**Out-of-hours emergencies** (the portal is down, a security incident): [name] · [phone].

**Routine improvements and small bugs** go to the feedback log — link pinned in the staff channel. Anyone can add a row; the Project Leader triages within one working day.

**Cadence after go-live:**

| Tempo | What | Who |
|---|---|---|
| Daily during launch week | The Project Leader reads the feedback log before 09:00. | Project Leader |
| Weekly | 30-minute system-health call. Open list reviewed. | Project Leader + dev + business owner |
| Monthly | Backlog review. Top three enhancements enter the next sprint. | Project Leader + business owner |
| Quarterly | UAT-lite. One tester per role runs Scenario A to catch regressions. | Project Leader |

---

## Appendices

### Appendix A — Quick URL reference

| Where you want to go | URL |
|---|---|
| Sign in | https://portal.richmond-afri.com/sign-in |
| Recover password | https://portal.richmond-afri.com/auth/recover |
| Your dashboard | the portal sends you there automatically after sign-in |
| Public contract verifier | https://portal.richmond-afri.com/verify/[contract-id] |
| Apply (Sino Metals example) | https://portal.richmond-afri.com/apply/sino-metals-leach-zambia-limited |

### Appendix B — Approval tiers

Set at submission based on the affordability calculation. As of v1.0:

| Tier | Triggered when | Final approver |
|---|---|---|
| **L1** | Smallest amounts within comfortable debt ratio | Approver L1 (Branch Manager) |
| **L2** | Mid-size amounts or borderline debt ratio | Approver L2 |
| **L3** | Larger amounts, or any case where the CFO is required by policy | Chief Finance Officer |

Per-employer thresholds are configured in the employer's record by the Master Administrator. The exact numbers are in each employer's MOU appendix; see the legal pack for the binding figures.

### Appendix C — Standard documents required from a borrower

Every application uploads the following eight documents through the wizard, and then confirms their mobile by SMS one-time code before submitting:

1. NRC — front
2. NRC — back
3. Photograph of the borrower (passport-style)
4. Employment contract or confirmation letter
5. Payslip — last month
6. Payslip — two months ago
7. Payslip — three months ago
8. Bank statement or a clear photo of the borrower's debit card (showing name + card number)

**Payslip rule:** the three payslips must be the borrower's preceding three months ending with the last fully-paid month. The portal reads each payslip with Claude vision on upload and shows the CSE the extracted gross / net / pay period inline — please cross-check against the file before passing `payslip_3mo_consistent`.

**Phone confirmation:** between the documents step and the loan-amount step, the borrower is sent a one-time code by SMS to the mobile we hold on file. Entering the code proves the number we'll text status updates to is live and controlled by them. This step is **recommended but not mandatory** — a borrower can skip it and still submit (so a missing SMS never strands an application). When they do confirm, the timestamp is recorded for the file.

Some employers' MOUs add specific further documents (e.g. a manager's letter, an employee number printed by the payroll system). Those variances are not yet hard-coded in the portal — they are recorded as the **per-employer DD variances** follow-on. Until then, CSEs should follow the MOU-specific schedule and treat any missing MOU-specific document as a `fail` on the corresponding check.

### Appendix D — Indicative service-level timings

| Stage | Target time | Hard cap |
|---|---|---|
| Borrower submits → CSE opens | 1 working hour | 4 working hours |
| CSE / BM both sign off | 1 working day | 2 working days |
| L1 decision | 4 working hours | 1 working day |
| L2 decision | 4 working hours | 1 working day |
| Employer attestation | 1 working day | 2 working days (auto-reminder at 24h) |
| L3 decision | 4 working hours | 1 working day |
| Disbursement after L3 | same working day | 1 working day |

### Appendix E — Acknowledgement of receipt

> *To be torn off and returned to the Project Leader on or before Day 1.*

I have read this Staff Handbook (Version 1.0). I understand my role in the Richmond Finance Employee Payroll Loan Portal and the rules — segregation of duties, data protection, audit — by which I am to use it.

**Name:** ____________________________________

**Role assigned in portal:** ____________________

**Signature:** ________________________________

**Date:** ___________________

---

*Confidential. Richmond Finance Limited. Distribution restricted to Richmond Finance staff and authorised employer-partner contacts. Do not copy or forward outside the organisation.*
