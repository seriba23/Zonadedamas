# Product Brief

## Vision

SaaS platform for beauty/wellness businesses (salons, barbershops, spas, clinics), inspired by Fresha but improved in: granular RBAC, IF/THEN automations, audit/events, availability engine performance, and API-first extensibility.

---

## MVP Scope (8-12 weeks)

### INCLUDES

- Multi-tenant with locations (branches)
- Auth with JWT access+refresh token rotation
- Granular RBAC (50+ permissions, 7 default roles, location-scoped)
- Clients CRUD with tags, search, notes
- Services CRUD with durations, buffers, pricing
- Employees with weekly schedules, time-off, service assignments
- Resources (rooms/chairs) management
- Availability engine with caching (Redis), anti-double-booking (PostgreSQL exclusion constraints)
- Appointments with status flow (pending → confirmed → in_progress → completed/cancelled/no_show)
- Basic POS (manual payments: cash/card/transfer, tips, discounts)
- Audit log (append-only, full diff tracking)
- Domain events (for cache invalidation and future integrations)
- Basic reports (revenue, appointments count, no-show rate)
- API-first (all functionality exposed via REST API)
- Health endpoint

### DOES NOT INCLUDE (MVP)

- Public online booking page (V1)
- Automations engine execution (V1, tables created in MVP)
- Email/SMS/WhatsApp notifications (V1, templates table created)
- Drag-and-drop calendar (V1)
- Marketplace/discovery (V2)
- Mobile app (V2)
- Multi-currency (V2)
- Integrations marketplace (V2)
- White-label (V2)
- Google Calendar sync (V1)

---

## V1 Additions

- Public online booking page (`/book/[tenantSlug]`)
- Automation engine IF/THEN (event-driven + cron triggers)
- Email + SMS notifications (appointment reminders, confirmations, follow-ups)
- Drag-and-drop calendar (reschedule by drag)
- Advanced reports with charts
- Google Calendar sync
- Client portal (view/manage own appointments)
- Waitlist

---

## V2 Additions

- Marketplace/discovery (clients find businesses)
- Mobile app (React Native)
- Multi-currency + multi-language
- API marketplace (third-party integrations)
- White-label option
- Subscription billing (Stripe)
- Loyalty programs
- Gift cards
- Inventory management

---

## Differentiators vs Fresha

| Feature | Fresha | Zona de Damas |
|---|---|---|
| RBAC | Basic roles | 50+ granular permissions, location-scoped |
| Automations | Limited | Full IF/THEN engine with conditions, anti-spam, quiet hours |
| Audit Trail | Minimal | Append-only audit log with before/after diffs |
| Availability | Standard | Cached availability with event-driven invalidation |
| API | Limited | API-first, all features accessible via REST + webhooks |
| Events | None | Domain events for real-time integrations |
| Multi-tenant | Single business | Full multi-tenant with location isolation |
