-- Phase 1.5 / 17 — Seed the canonical Loan Agreement template (v1).
--
-- Merged from:
--   • Richmond Part B Loan Agreement v1.1 (verbatim clauses)
--   • Industry-standard clauses for Zambian payroll-deduction lending
--     (governing law, arbitration, ECT Act 2021, Data Protection Act 2021,
--     AML/CTF, severability, entire-agreement, notices)
--
-- Once published, this row is immutable. Future versions create a new row
-- with `version = 2`.

insert into public.contract_templates (
  template_key, version, name, body_html, variables,
  required_signatories, published_at, effective_from
) values (
  'loan_agreement',
  1,
  'Loan Agreement (Employer Payroll-Deduction Scheme) v1',
  $html$
<h1>LOAN AGREEMENT</h1>
<p class="subtitle">Employer Payroll-Deduction Scheme</p>

<section id="parties">
<h2>1. Parties</h2>
<p>
  This Loan Agreement (the "<strong>Agreement</strong>") is entered into on
  <em>{{signing_date}}</em> at Lusaka, between:
</p>
<ol>
  <li>
    <strong>RICHMOND FINANCE LIMITED</strong>, a Zambian private company limited
    by shares (Company Registration No. 120180001942), having its registered
    office at 4th Floor Telecom House, Mwaimwena Road, Rhodes Park, Lusaka
    (the "<strong>Lender</strong>"); and
  </li>
  <li>
    <strong>{{borrower_full_name}}</strong> (NRC No. {{borrower_nrc}}) of
    {{borrower_residential_address}} (the "<strong>Borrower</strong>"),
    being an employee of <strong>{{employer_legal_name}}</strong>
    (the "<strong>Employer</strong>").
  </li>
</ol>
</section>

<section id="definitions">
<h2>2. Definitions</h2>
<dl>
  <dt>Disbursed Amount</dt><dd>Principal less the Administration Fee, Insurance Fee, and any settlement of an existing facility being refinanced.</dd>
  <dt>Instalment</dt><dd>The monthly amount specified in the Schedule, deductible at source from the Borrower's salary.</dd>
  <dt>MOU</dt><dd>The Memorandum of Understanding between the Lender and the Employer governing payroll deductions.</dd>
  <dt>Schedule</dt><dd>The repayment schedule attached to this Agreement, forming an integral part hereof.</dd>
</dl>
</section>

<section id="particulars">
<h2>3. Loan Particulars</h2>
<table class="particulars">
  <tr><td>Loan Reference</td><td><strong>{{loan_no}}</strong></td></tr>
  <tr><td>Principal Amount</td><td>K {{principal_zmw}}</td></tr>
  <tr><td>Administration Fee (2%)</td><td>K {{admin_fee_zmw}}</td></tr>
  <tr><td>Insurance Fee (2%)</td><td>K {{insurance_fee_zmw}}</td></tr>
  <tr><td>Disbursed Amount</td><td>K {{disbursed_amount_zmw}}</td></tr>
  <tr><td>Monthly Interest Rate</td><td>{{monthly_interest_rate_pct}}%</td></tr>
  <tr><td>Tenure</td><td>{{tenure_months}} months</td></tr>
  <tr><td>Total Interest</td><td>K {{total_interest_zmw}}</td></tr>
  <tr><td>Total Collectable</td><td>K {{total_collectable_zmw}}</td></tr>
  <tr><td>Monthly Instalment</td><td>K {{monthly_installment_zmw}}</td></tr>
  <tr><td>First Instalment Due</td><td>{{first_instalment_date}}</td></tr>
  <tr><td>Final Instalment Due</td><td>{{final_instalment_date}}</td></tr>
</table>
</section>

<section id="loan">
<h2>4. The Loan</h2>
<p>The Lender agrees to make available to the Borrower the Principal Amount on the
terms set out in this Agreement and the Schedule. Disbursement is effected by
transfer to the Borrower's nominated account or mobile-money number. The
Borrower acknowledges receipt of the Disbursed Amount by signing this
Agreement, whereupon the Agreement becomes binding.</p>
</section>

<section id="interest">
<h2>5. Interest</h2>
<p>Interest is charged on a <em>straight-line</em> basis at the Monthly Interest
Rate stated in §3 and is <strong>fixed</strong> for the period of the loan.
Total Interest = Principal × Monthly Interest Rate × Tenure (months).</p>
</section>

<section id="fees">
<h2>6. Fees</h2>
<p>The Administration Fee and Insurance Fee are <strong>one-off charges</strong>
deducted upfront from the Principal at disbursement. The same fees apply to any
top-up or refinancing facility granted under this Agreement. Insurance coverage
becomes effective after six (6) successful monthly recoveries have been
realised, or where the Borrower has had a performing account for more than six
months, whichever comes first. All insurance claims are payable to the Lender
per the policy cover note between the Lender and the insurer.</p>
</section>

<section id="repayment">
<h2>7. Repayment &amp; Salary-Deduction Authorisation</h2>
<p>7.1 The Borrower irrevocably authorises the Employer to deduct each Instalment
from the Borrower's salary and to remit the same to the Lender by the
{{remittance_day}}th of the following month, in accordance with the MOU.</p>
<p>7.2 This authorisation is irrevocable until the loan is fully repaid.</p>
<p>7.3 The Lender may require post-dated cheques or standing-order instructions
in addition to payroll deduction.</p>
<p>7.4 Payments received are applied in the following order:
<strong>(a) legal and recovery costs, (b) accrued interest, (c) principal</strong>.</p>
<p>7.5 In the case of payroll-based deductions, the Borrower has an obligation
to ensure the Employer is remitting payments promptly so as not to fall into
arrears.</p>
</section>

<section id="termination">
<h2>8. Termination of Employment</h2>
<p>8.1 On the Borrower leaving employment for <em>any</em> reason, the outstanding
loan becomes <strong>immediately repayable in full</strong>.</p>
<p>8.2 The Employer reserves the right under the MOU to deduct any sums owed
from the Borrower's terminal benefits, gratuity, and last monthly salary
due, and to remit the same to the Lender.</p>
<p>8.3 The Borrower undertakes to notify the Lender in writing within
seven (7) days of any change in employment status (resignation, dismissal,
retrenchment, retirement, suspension).</p>
</section>

<section id="default">
<h2>9. Default &amp; Breach</h2>
<p>9.1 The Borrower is in default upon:
<ul>
  <li>failure to pay any amount when due; or</li>
  <li>breach of any term of this Agreement.</li>
</ul></p>
<p>9.2 On default the Lender may, at its sole election and without notice:
<ul>
  <li>declare the full balance immediately due and recover it, together with
      interest accrued to the date of payment and all costs on an
      attorney-and-own-client scale;</li>
  <li>institute legal proceedings; and</li>
  <li>list the default with any registered credit reference bureau.</li>
</ul></p>
<p>9.3 <strong>Certificate of Debt.</strong> A certificate signed by any officer
of the Lender stating the amount owed by the Borrower shall be admissible as
prima facie evidence of the amount due and shall be accepted by any court as
correct unless the Borrower proves otherwise.</p>
<p>9.4 If another lender or finance provider seeks to settle this facility on
the Borrower's behalf, the Lender reserves the right to demand the loan be
paid in full to the Lender directly.</p>
</section>

<section id="covenants">
<h2>10. Borrower Covenants</h2>
<p>10.1 The Borrower shall not close the bank account into which the loan is
disbursed for the duration of this Agreement.</p>
<p>10.2 The Borrower authorises the Lender to access information from any
credit reference bureau and to register conduct of this account with such
bureaus. The Borrower waives any claim against the Lender in respect of such
disclosure.</p>
<p>10.3 The Borrower warrants that the personal information supplied is true,
complete, and accurate and that the loan will not be used for any unlawful
purpose.</p>
<p>10.4 The Borrower confirms compliance with the
<em>Anti-Money Laundering Act No. 44 of 2010 (as amended)</em> and the
<em>Anti-Terrorism Act No. 21 of 2007</em>, and that no part of the funds
involved arises from unlawful activity.</p>
</section>

<section id="data-protection">
<h2>11. Data Protection</h2>
<p>The Lender processes the Borrower's personal data in accordance with the
<em>Data Protection Act No. 3 of 2021 (Zambia)</em>. The Borrower consents
to the collection, storage, processing, and sharing of personal data with
the Employer, credit-reference bureaus, regulators, and the Lender's
insurers and lawyers, strictly for purposes connected with this Agreement.</p>
</section>

<section id="electronic-execution">
<h2>12. Electronic Execution</h2>
<p>This Agreement may be executed electronically. The parties agree that
electronic signatures captured through the Lender's portal have the same
legal effect as handwritten signatures under the
<em>Electronic Communications and Transactions Act No. 4 of 2021 (Zambia)</em>.
Each party acknowledges that the cryptographic seal (PAdES-B-T) applied to
the final PDF constitutes conclusive evidence of identity and integrity of
the document.</p>
</section>

<section id="governing-law">
<h2>13. Governing Law</h2>
<p>This Agreement is governed by and construed in accordance with the laws
of the Republic of Zambia.</p>
</section>

<section id="dispute">
<h2>14. Dispute Resolution</h2>
<p>14.1 The parties shall first attempt to resolve any dispute through good-faith
negotiation between their respective chief executive officers (or equivalent)
within thirty (30) days of written notice of the dispute.</p>
<p>14.2 If unresolved, the dispute shall be referred to arbitration under the
<em>Arbitration Act No. 19 of 2000 (Zambia)</em>. The seat of arbitration shall
be Lusaka. A single arbitrator shall be appointed by agreement, failing which
by the President of the Law Association of Zambia.</p>
</section>

<section id="general">
<h2>15. General</h2>
<p>15.1 <em>Entire Agreement.</em> This Agreement, together with the loan
application form, the Schedule, and the MOU, constitutes the entire agreement
between the parties.</p>
<p>15.2 <em>Variation.</em> No variation is effective unless reduced to writing
and signed by both parties (electronic execution sufficing).</p>
<p>15.3 <em>No Waiver.</em> No failure or delay by the Lender in exercising any
right operates as a waiver of that right.</p>
<p>15.4 <em>Severability.</em> If any provision is held invalid or unenforceable,
the remaining provisions continue in full force and effect.</p>
<p>15.5 <em>Statement of Account.</em> The Borrower may request, at a minimal
administrative charge as determined by the Lender, a statement setting out all
repayments, the outstanding balance, and any amounts in arrears.</p>
</section>

<section id="notices">
<h2>16. Notices</h2>
<p>Notices to the Lender:<br/>
Richmond Finance Limited<br/>
4th Floor Telecom House, Mwaimwena Road, Rhodes Park, Lusaka<br/>
Email: tpatel@richmond-fin.com</p>
<p>Notices to the Borrower: as stated in the loan application form (or as last
notified in writing to the Lender). Notices delivered via email or SMS are
deemed to have been sent and received on the date sent.</p>
</section>

<section id="signatures">
<h2>17. Signatures</h2>
<p>Executed electronically under the Electronic Communications and
Transactions Act No. 4 of 2021. Signature evidence and timestamps are
captured in the Certificate of Completion appended hereto.</p>
<table class="signatures">
  <tr>
    <td><strong>Borrower:</strong> {{borrower_full_name}}<br/>NRC: {{borrower_nrc}}<br/>Signed: {{borrower_signed_at}}</td>
    <td><strong>Employer Signatory:</strong> {{employer_signatory_name}}<br/>Position: {{employer_signatory_position}}<br/>Signed: {{employer_signatory_signed_at}}</td>
    <td><strong>Richmond Finance:</strong> {{richmond_witness_name}}<br/>Designation: {{richmond_witness_designation}}<br/>Signed: {{richmond_witness_signed_at}}</td>
  </tr>
</table>
</section>
$html$,
  jsonb_build_object(
    'borrower_full_name', 'string',
    'borrower_nrc', 'string',
    'borrower_residential_address', 'string',
    'employer_legal_name', 'string',
    'loan_no', 'string',
    'principal_zmw', 'money',
    'admin_fee_zmw', 'money',
    'insurance_fee_zmw', 'money',
    'disbursed_amount_zmw', 'money',
    'monthly_interest_rate_pct', 'percent',
    'tenure_months', 'integer',
    'total_interest_zmw', 'money',
    'total_collectable_zmw', 'money',
    'monthly_installment_zmw', 'money',
    'first_instalment_date', 'date',
    'final_instalment_date', 'date',
    'remittance_day', 'integer',
    'signing_date', 'date',
    'borrower_signed_at', 'datetime',
    'employer_signatory_name', 'string',
    'employer_signatory_position', 'string',
    'employer_signatory_signed_at', 'datetime',
    'richmond_witness_name', 'string',
    'richmond_witness_designation', 'string',
    'richmond_witness_signed_at', 'datetime'
  ),
  array['borrower','employer_signatory','richmond_witness']::public.contract_signatory_role[],
  now(),
  date '2026-05-12'
)
on conflict (template_key, version) do nothing;
