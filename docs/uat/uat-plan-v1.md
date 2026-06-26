# UAT plan — Richmond Finance Employee Payroll Loan Portal

Version 1.0 · 17 June 2026 · Owner: Project Leader

This is the document the Project Leader runs from during user-acceptance testing. It assumes **10 testers, one role each**. There is no role-swapping in this plan — the live workflow's maker-checker rules require distinct people, and we want each tester to feel only their own UI.

The portal under test is at **https://richmond-eplp-portal.fly.dev** (production / `main`). All test loans are real database rows; they do not need to be reversed because the test employer pools are sized for it.

---

## 1. Roster — who does what

| # | Role | Real-world fit | Email pattern | Test employer scope |
|--:|---|---|---|---|
| PL | **Project Leader** | Tristan (or delegate) | tristanpatel@yahoo.co.uk | — (no in-app role; uses `master_admin` to assign and observe) |
| 1 | master_admin | Person who can stand up new staff/employer accounts and break-glass | (existing) | All |
| 2 | branch_manager | Branch head or COO designate | new | Lusaka (LS) branch |
| 3 | cse | Customer service exec, first reviewer | (existing — Adam Bot) | LS branch |
| 4 | approver_l1 | Credit officer L1 | test-approver-l1@richmond-fin.com | All |
| 5 | approver_l2 | Credit officer L2 (**must not be the same person as #4**) | test-approver-l2@richmond-fin.com | All |
| 6 | accounts | Finance / disbursement officer | (existing — Musonda Test) | All |
| 7 | cfo | Final approver + P&L viewer | (existing — CFO Demo) | All |
| 8 | auditor | Compliance / internal audit (read-only) | test-auditor@richmond-fin.com | All |
| 9 | employer_admin | HR/Payroll contact at Sino Metals | test-employer-admin@sino-metals.com | Sino Metals only |
| 10 | borrower (employee) | A real Sino Metals employee | will self-sign-up via apply link | own application only |

> The four `test-*` accounts were created earlier in this session; temporary passwords were issued separately. The Project Leader can reset any of them from `/admin/staff` → row → **Reset password**.

---

## 2. Project Leader playbook

The Project Leader has no in-app role — they sign in as `master_admin` only to provision and observe.

### 2.1 Day −1 (prep)

1. **Confirm the 10 testers** and their email addresses. Replace any of the placeholder accounts in §1 with the real person's email (rename via `/admin/staff/[id]` → Edit).
2. **Brief the testers** with this document and a 1-page "what your role does" extract (§4 — each tester reads only their section).
3. **Pick the test employer**. Default: Sino Metals (pool K5,000,000; existing signatory AI Guy; the four `test-*` accounts already point at it). For multi-employer testing, also use Choppies (K4,000,000) or Seba Foods (K3,000,000) on Day 2.
4. **Send credentials securely.** Use Signal/encrypted email. Temporary passwords are in the project chat — do not paste them into shared docs.
5. **Open the feedback log** (§6). One row per finding. Pin the link in the test channel.
6. **Schedule three sessions** (§5): Day 1 morning, Day 1 afternoon, Day 2 morning. Block 90 minutes each.

### 2.2 During each session

| Time | Action |
|---|---|
| T+0 | Roll call. Each tester confirms they can sign in and land on their dashboard. Anyone who can't = blocker; PL re-issues credentials and re-tests. |
| T+5 | PL announces which scenario (§5) is being run. |
| T+5–T+60 | PL watches the queue page (`/admin/applications`) live while the scenario runs. PL does not perform workflow actions — observe only. |
| T+60–T+90 | Debrief. Each tester reports: what they did, what worked, what failed, what they noticed. PL logs every finding into the feedback log on the spot. |

### 2.3 Day +1 (after UAT)

1. **Triage the feedback log** (§6 statuses).
2. **Re-test** any items where a fix was shipped during UAT.
3. **Sign-off form** (§7) once all P0/P1 are resolved.

---

## 3. Account assignment — Project Leader's one-page table

The Project Leader fills this in before Day 1 and shares it in the team channel.

| # | Role | Tester name | Email | Phone (for SMS) | Confirmed sign-in? |
|--:|---|---|---|---|:--:|
| 1 | master_admin | ____ | ____ | ____ | ☐ |
| 2 | branch_manager | ____ | ____ | ____ | ☐ |
| 3 | cse | ____ | ____ | ____ | ☐ |
| 4 | approver_l1 | ____ | ____ | ____ | ☐ |
| 5 | approver_l2 | ____ | ____ | ____ | ☐ |
| 6 | accounts | ____ | ____ | ____ | ☐ |
| 7 | cfo | ____ | ____ | ____ | ☐ |
| 8 | auditor | ____ | ____ | ____ | ☐ |
| 9 | employer_admin | ____ | ____ | ____ | ☐ |
| 10 | borrower | ____ | ____ | ____ | ☐ |

---

## 4. Per-tester scripts

Each tester reads only their own section. Time per script is the **first run** — subsequent scenarios reuse the same paths and take ~5 minutes each.

### 4.1 Borrower (#10) — ~15 min

1. Open `https://richmond-eplp-portal.fly.dev/apply/sino-metals-leach-zambia-limited`.
2. Click **Start application** → fill in name + email → enter the 6-digit code from email.
3. On the apply wizard, complete every step: Profile, Employment, Bank, **Documents** (upload eight files: NRC front/back, photo, contract, three payslips, bank statement *or* a debit-card photo — sample pack in the test channel), **Confirm phone** (request an SMS code to the borrower's mobile, type it back), **Amount** (request **K3,000 over 6 months** — the form pre-fills "Maximum loan available" from your OCR'd payslips), Review & Submit.
4. **Expected**: status changes to "submitted", you get an in-app notification, and Sign out → Sign in returns you straight to your application page.
5. **Report**: anything confusing, slow, broken, or where you didn't know what to do.

### 4.2 CSE (#3) — ~15 min

1. Sign in → `/admin/applications`. Find borrower's new application.
2. Click in → confirm you see **Borrower documents** panel with eight items. Click **Open** on each — every file should render in a new tab. For each payslip, an OCR line shows the extracted gross / net / pay period — **cross-check those against the payslip image** before passing the DD checks `payslip_3mo_consistent` and `net_pay_meets_threshold`.
3. Click **Start CSE review** → due diligence checklist appears. Mark every check pass (or fail with a note where appropriate — the borrower's salary, payslips, NRC are all valid in test data).
4. Click **Sign off as CSE**.
5. **Expected**: status moves; if BM hasn't signed yet you see "awaiting branch_manager sign-off"; if BM signed first, status flips to `l1_pending`.
6. **Report**: any check whose meaning isn't clear; any document that didn't open; any field that doesn't reflect what the document shows.

### 4.3 Branch manager (#2) — ~10 min

1. Sign in → `/admin/applications` → open same application.
2. Verify CSE has signed (or sign before them — order doesn't matter).
3. Click **Sign off as branch_manager**.
4. **Expected**: once both you and CSE have signed, status flips to `l1_pending`. A notification fires to L1 approvers.
5. **Report**: anything unclear about which checks the BM is responsible for vs CSE.

### 4.4 Approver L1 (#4) — ~5 min

1. Sign in → `/admin/applications`. Filter to `l1_pending`.
2. Open the application → click **Approve** (add a note). Or click **Reject** if testing the negative path.
3. **Expected**: status → `l2_pending`. You **cannot** approve at L2 later (the maker-checker should block it — try it and report what you see).
4. **Report**: clarity of the approval card, whether the application's affordability summary tells you enough to decide.

### 4.5 Approver L2 (#5) — ~5 min

Same as #4 but at `l2_pending` → approves to `l3_pending`. Confirm you are **not** allowed to also approve at L1 retroactively.

### 4.6 Employer signatory / admin (#9) — ~10 min

1. Sign in → lands on `/employer`. You should see a row "Awaiting your confirmation" with the borrower's request.
2. Verify the four facts visible: employee name, employee number, basic salary, monthly deduction.
3. Click **Confirm** (positive path). On a second test run, click **Decline** with a reason to test the negative path.
4. **Expected**: borrower receives a notification; status of attestation updates in your history.
5. **Report**: whether the data shown is enough to make the decision; whether you ever see anything outside your employer's scope (you should not).

### 4.7 CFO (#7) — ~10 min

1. Sign in → `/admin`. Open the application at `l3_pending`.
2. **Before** employer has attested: try to approve → system should block with a clear message. Report what you see.
3. **After** employer attests `confirmed`: approve at L3. Status → `approved`. A loan row is auto-created.
4. Visit `/admin/reports/pnl`. Confirm the new loan appears in the P&L roll-up.
5. **Report**: any number that looks wrong; any approval guard that's confusing.

### 4.8 Accounts (#6) — ~10 min

1. Sign in → `/admin/loans`. Filter to `pending_disbursement`.
2. Open the new loan → confirm bank details + amount.
3. Click **Mark disbursed** (or whatever the button reads).
4. **Expected**: status → `active`; borrower receives a disbursement notification.
5. **Report**: any disbursement check that should exist but doesn't.

### 4.9 Auditor (#8) — ~10 min

1. Sign in → `/admin/activity`. Filter by today.
2. You should see every action taken during the session (submit, sign-offs, approvals, attestation, disbursement). Each row has actor + entity + before/after.
3. Try to UPDATE anything in any screen. You should not be able to. Report any place where you can.
4. **Report**: any action that's missing from the audit log; any place an edit was allowed.

### 4.10 Master admin (#1) — ~10 min

1. Sign in → `/admin`. Confirm the four KPIs (Open applications, Active loans, Pending disbursement, Total outstanding).
2. Visit `/admin/staff`. You should see the 9 staff/employer accounts; borrowers should **not** appear here.
3. Visit `/admin/staff/[any-tester]` and inspect their per-user audit drill-down.
4. **Report**: any field that's mislabeled or any screen that doesn't render with live data.

---

## 5. Scenarios — what to run

Each scenario walks the same borrower's loan through a different path. All testers stay logged in; the Project Leader announces which scenario is running.

### Scenario A — clean L3 loan ("the golden path") · ~45 min

`borrower submits → CSE marks DD → BM signs → CSE signs → L1 approves → L2 approves → employer confirms → CFO approves → accounts disburses → auditor verifies`.

Use **K3,000 over 6 months** at Sino Metals. Tier should resolve to **L3** because the amount × debt-ratio crosses Sino's L3 threshold.

### Scenario B — employer declines · ~30 min

A fresh borrower submits → CSE/BM sign off → L1, L2 approve → **employer signatory declines** with reason "employee on disciplinary leave" → CFO tries L3 → must be blocked → application sits stuck → auditor confirms the declined attestation is on the timeline.

### Scenario C — CSE rejects on DD · ~20 min

Borrower submits with deliberately weak inputs (e.g. requested K20,000 — pushes debt ratio over Sino's cap). CSE marks `debt_ratio_within_limit` as **fail** → tries to sign off → must be blocked.

### Scenario D — maker-checker negatives · ~15 min

Two tries:
1. Approver L1 attempts to also approve at L2 → must be blocked.
2. Borrower attempts to sign in and call any approval API (via browser dev console if needed) → must be blocked.

Both should produce clean error messages, **not** 500s.

---

## 6. Feedback log

Maintain as a single spreadsheet (Google Sheet / Excel in OneDrive). Pin the link in the test channel. Project Leader is the only person who edits **Status** and **Priority**; testers add rows for findings.

| Column | Values |
|---|---|
| ID | auto-incrementing (FB-001, FB-002…) |
| When | timestamp of finding |
| Who reported | tester role + name |
| Category | bug / improvement / enhancement / clarification |
| Screen / URL | exact path |
| What happened | one-line description |
| Expected | what should have happened |
| Steps to reproduce | numbered list |
| Screenshot | link |
| Priority | **P0** (blocks the workflow), **P1** (workaround exists, must fix before launch), **P2** (annoyance / cosmetic), **P3** (nice to have / future) |
| Status | new / triaged / in progress / fixed / re-test / closed / wont-fix |
| Linked PR | github PR # when a fix lands |

### Categories — definitions for testers

- **Bug** — system did the wrong thing or threw an error.
- **Improvement** — system did the right thing, but the path was confusing, slow, or hard.
- **Enhancement** — a new capability you wish existed.
- **Clarification** — you weren't sure if the result was correct; PL to confirm.

---

## 7. Sign-off

UAT is complete when:

- All **P0** items are closed.
- All **P1** items are either closed or scheduled with a fix date on the backlog.
- The Project Leader has run Scenario A end-to-end with the fixed code (the "regression cycle").
- Each of the 10 testers has signed the log (initial against their role).

---

## 8. Improvement loop — how "improve further" becomes real

After UAT signs off, the same feedback log keeps living. The cadence:

| Tempo | Activity | Owner |
|---|---|---|
| Daily during launch week | PL reads the log every morning. Anything new → triaged within 2h. | Project Leader |
| Weekly post-launch | 30-min "system health" call. Walk the open list. Decide what gets a fix this week. | PL + dev |
| Monthly | Backlog review. Score enhancements (impact × effort). Top 3 enter the next sprint. | PL + business owner |
| Quarterly | UAT-lite. Run Scenario A with one tester per role to make sure nothing regressed. | PL |

---

## 9. Known follow-ons (already on the radar)

These came out of the live system test on 16 June 2026 and the MOU review. They're **not** UAT bugs but they're worth listing so testers know what's already known:

1. **Per-employer DD variances** — the seed checklist is currently fixed at 12 items. The MOUs (Sino Metals, C4C, etc.) show each employer has slightly different documentary and threshold requirements. The plan is a small new table `employer_dd_overrides` plus an update to `seed_due_diligence()`. Tracking separately from UAT.
2. **`extension_in_public` advisor** — `citext` and `pg_net` live in `public`. Cosmetic; deferred past launch.
3. **`is_richmond_staff()` anon-callable** — kept by design because two RLS policies for the public verifier path reach it. Cleaner fix needs a small policy refactor; not blocking UAT.

---

## Appendix A — Quick sign-in matrix

Paste this into the test channel; testers reference it from their phone.

```
Portal:   https://richmond-eplp-portal.fly.dev
Sign in:  https://richmond-eplp-portal.fly.dev/sign-in
                                                     after login lands you on
master_admin       → /admin
branch_manager     → /admin
cse                → /admin
approver_l1        → /admin
approver_l2        → /admin
accounts           → /admin
cfo                → /admin
auditor            → /admin
employer_admin     → /employer
employer_signatory → /employer
borrower (employee)→ /portal
```

If after login you end up on `/sign-in` again, capture a screenshot and tell the Project Leader immediately — that's a P0 access bug.
