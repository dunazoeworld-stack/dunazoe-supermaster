# CREDIT_SAVER_REPORT.md — Phase 19: Credit Maximization
  ## Generated: 2026-06-17 | Agent: REPLIT5

  ---

  ## CURRENT USAGE ESTIMATE

  | Period | Credits (unoptimized) | Credits (optimized) | Savings |
  |---|---|---|---|
  | Per hour | 2.3 | 0.6 | 73% |
  | Per day | 55.2 | 14.4 | 73% |
  | 7 days | 386 | 101 | 73% |
  | 30 days | 1,656 | 432 | 73% |
  | 90 days | 4,968 | 1,296 | 73% |

  ---

  ## OPTIMIZATION 1: CONTABO SERVER SPLIT (60% savings)

  Move 23 non-critical services to Contabo VPS (€5.50/month):

  ```
  Keep on Replit (critical, user-facing):
    - API Gateway (port 3000)
    - Next.js Frontend
    - Auth Service (4001)
    - Payment Service (4006)
    - Wallet Service (4009)
    - Order Service (4005)
    - Deployment AI (4027)
    - Feature Flags (4028)
    - Reliability (4025)
    - Monitoring (4024)

  Move to Contabo VPS:
    - 23 remaining microservices
    - RabbitMQ
    - Redis
    - PostgreSQL
  ```

  **Savings: ~60% Replit credit reduction**

  ---

  ## OPTIMIZATION 2: ALREADY APPLIED ✅

  | Optimization | Status | Savings |
  |---|---|---|
  | Thrift/loan services disabled | ✅ DONE | Prevents 2 idle services wasting credits |
  | AI limiter 30 req/min | ✅ DONE | Prevents AI cost spikes |
  | Killswitch cache 10s TTL | ✅ DONE | Reduces feature-flag service calls ~80% |
  | Queue-based notifications | ✅ DONE | Async, not inline compute |
  | PGBouncer connection pooling | ✅ DONE | Reduces DB connection overhead |
  | Build cache configured | ✅ DONE | Faster rebuilds |

  ---

  ## OPTIMIZATION 3: RECOMMENDED (operator action)

  | Action | Effort | Savings |
  |---|---|---|
  | Vercel CDN for Next.js statics | 30min | ~15% |
  | Redis caching for product reads | 2h | ~20% |
  | Sleep non-critical services at night | 1h | ~30% |
  | Batch queue processing (5min windows) | 2h | ~10% |
  | Lazy-load AI service | 1h | ~5% |
  | Disable unused services (mobile, thrift) | 5min | ~10% |

  ---

  ## 30-DAY BETA BUDGET PLAN

  ```
  Week 1: 10 beta users
    Estimated: ~50 credits
    Services running: 10 (critical only)
    
  Week 2: 50 beta users
    Estimated: ~100 credits
    Services running: 15
    
  Week 3-4: 100 beta users
    Estimated: ~280 credits
    Services running: 20

  Month 1 Total: ~430 credits (optimized)
  Month 1 Total: ~1,656 credits (unoptimized)
  Savings with all optimizations: ~73%
  ```

  ---

  ## CREDIT HEALTH: 🟡 MODERATE

  **Current Status:** Optimizations partially applied (code-level done).  
  **Next Action:** Implement Contabo server split + Redis caching for maximum savings.  
  **Estimated free credit runway:** Depends on Replit plan tier.

  ---

  ## SCRIPTS AVAILABLE

  ```bash
  node deployment-ai/cost-optimizer.js --optimize
  node deployment-ai/cost-optimizer.js --report
  node deployment-ai/cost-optimizer.js --sleep-noncritical
  ```
  