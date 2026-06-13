# DUNAZOE OS — THREAT MODEL v4
## STRIDE Analysis | Updates #93–#96 Applied

## SYSTEM OVERVIEW
DUNAZOE OS — Nigerian AI-powered commerce + fintech OS.
Real money (NGN+USD), escrow, thrift/Ajo savings, KYC, social media AI, self-delivery.
31 microservices + API Gateway. Banking-grade but pre-license fintech architecture.

## TRUST BOUNDARIES
```
[Internet] → [Nginx :443 TLS1.3] → [API Gateway :3000] → [31 Microservices :4001-4031]
                                           ↓
                                   [HMAC Signed Internal]
                                           ↓
                              [PostgreSQL :5432 | Redis :6379]
                                           ↓
                                    [RabbitMQ :5672]

[Paystack/Stripe] → [/payments/webhook] → [Double Verification REQUIRED]
[Social Platforms] → [OAuth tokens only — NO raw passwords]
[Admin Impersonation] → [MFA + 30min session + full audit + user notified]
```

## STRIDE MATRIX

| ID | Category | Threat | Impact | Control |
|---|---|---|---|---|
| S-01 | Spoofing | JWT theft | Critical | 15-min tokens + blacklist |
| S-02 | Spoofing | Service impersonation | Critical | HMAC-SHA256 + nonce + timestamp |
| S-03 | Spoofing | Webhook forgery | Critical | Double-verify with Paystack API |
| S-04 | Spoofing | Social OAuth theft | Critical | OAuth tokens only, no passwords |
| S-05 | Spoofing | Admin impersonation | Critical | MFA + 30-min expiry + audit |
| T-01 | Tampering | Payment amount | Critical | Amount verified vs DB before escrow |
| T-02 | Tampering | Loan limit bypass | Critical | Enforced in ledgerEngine.loanDisbursement() |
| T-03 | Tampering | Escrow state bypass | Critical | State machine — cannot skip states |
| T-04 | Tampering | SQL injection | Critical | Parameterized queries + Joi validation |
| T-05 | Tampering | Webhook replay | High | idempotency_key UNIQUE + nonce |
| R-01 | Repudiation | Admin denies action | High | Immutable admin_actions table + IP |
| R-02 | Repudiation | Social post denial | High | social_audit_log with AI agent ID |
| I-01 | Info Disclosure | BVN/NIN leak | Critical | SHA-256 hash only — never stored raw |
| I-02 | Info Disclosure | Admin sees password | Critical | NEVER returned — architectural block |
| I-03 | Info Disclosure | IDOR | High | User can only access own data |
| D-01 | DoS | Login brute force | High | Progressive delay + 5-attempt lock |
| D-02 | DoS | DDoS | Critical | Nginx rate limit + Cloudflare WAF |
| D-03 | DoS | Wallet race condition | Critical | FOR UPDATE locks + idempotency |
| E-01 | EoP | JWT role forgery | Critical | Role from signed JWT only |
| E-02 | EoP | Loan > contribution | Critical | ledgerEngine throws — hard enforced |
| E-03 | EoP | Social high-risk bypass | Critical | Superuser approval required |

## HARD RULES — NEVER VIOLATED
```
1. max_loan_amount = total_contributed_amount (ledgerEngine enforces)
2. Webhook → NEVER credit without provider API verification
3. Cash payment → blocked at order service level (not just UI)
4. Admin impersonation → MFA required, user always notified
5. Social media → no raw passwords, OAuth tokens only
6. Bank account → 48-hour cooling-off, verified accounts only
7. Self-delivery → BOTH parties must consent
8. Sensitive data → passwords/PINs/CVV never accessible to any admin
```

## SECURITY RATING v4
| Domain | Score | Target |
|---|---|---|
| Authentication | 9.0/10 | 9.5 |
| Authorization | 9.2/10 | 9.5 |
| Financial Controls | 9.5/10 | 10.0 |
| Data Protection | 8.5/10 | 9.0 |
| Network Security | 8.5/10 | 9.5 |
| Social Media Security | 8.0/10 | 9.0 |
| **Overall** | **8.8/10** | **9.5** |

*Prepared by CTO | Review cycle: Quarterly*
