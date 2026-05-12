# Registered office (use on every contract, PDF letterhead, and legal notice)

```
Richmond Finance Limited
4th Floor, Telecom House
Mwaimwena Road, Rhodes Park
Lusaka, Zambia

Tel:   +260 965 503 484
Email: tpatel@richmond-fin.com
Web:   https://www.richmond-afri.com

Company Registration No. 120180001942
```

Use the structured block (`RegisteredOffice` type in
`@eplp/shared/contact`) when rendering inside PDF templates, never copy
the plain text — when this changes (e.g. new TPIN, new phone, new email)
we update one constant and every template picks it up.

## Domain map (DNS — change requires re-issuing signing cert page)

| Subdomain | Owner | Purpose |
|---|---|---|
| `www.richmond-afri.com` | Marketing site | Public-facing pages, `/legal/signing-cert` |
| `portal.richmond-afri.com` | Loan Portal (this repo) | App entry, `/verify/{contract_id}` |

Hosts beyond `www.` and `portal.` are out of scope for this repo.

## Public verifier URL

Embedded into every PAdES-B-T-sealed contract's certificate of completion.
**Once a contract is sealed, the literal string is immutable** — change DNS
but keep the path serving.

```
https://portal.richmond-afri.com/verify/{contract_id}
```

The verifier displays only: signatory names, signatory roles, signed-at
timestamps in Lusaka time, document hash, envelope hash. Never NRC, phone,
email, IP, or geolocation.

## Public signing certificate URL

```
https://www.richmond-afri.com/legal/signing-cert
```

Publishes the X.509 public key (PEM-encoded) of the Richmond Finance
signing certificate so external counterparties can verify sealed PDFs in
any standard PDF reader. Rotation is annual — see
[`docs/legal/signing-cert-rotation.md`](signing-cert-rotation.md) (added
in Phase 4).
