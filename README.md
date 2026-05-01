# Medplum Appointment Reminders by VisitConfirmed

Reduce no-shows by 15-30% with FHIR-native appointment confirmations for Medplum. AI voice calls, SMS reminders, calendar invites, and automated rescheduling — without building your own patient engagement system.

```
Medplum (FHIR Server)                  VisitConfirmed
┌──────────────────────┐               ┌───────────────────────────┐
│                      │               │                           │
│  Appointment created │               │  AI Voice Confirmation    │
│         │            │               │  Two-Way SMS              │
│         ▼            │    webhook    │  Calendar Invites (.ics)  │
│  FHIR Subscription   ├──────────────►│  Retry Logic              │
│                      │               │  Quiet Hours & Consent    │
│                      │  ◄────────────┤  Escalation to Staff      │
│  Appointment.status  │  FHIR write-  │  Rescheduling Workflows   │
│  Communication       │  back         │  No-Show Recovery         │
│  Task (escalation)   │               │                           │
└──────────────────────┘               └───────────────────────────┘
```

When a new Appointment is created in Medplum, a FHIR Subscription forwards it to VisitConfirmed. VisitConfirmed handles the rest: AI voice calls that have real conversations with patients, two-way SMS follow-ups, calendar invites, retry logic, quiet hours, consent management, and escalation to your staff when needed. Results are written back to Medplum as FHIR resources.

**Setup time: ~5 minutes — one command.** No infrastructure to manage.

## Quick start

### 1. Get a VisitConfirmed API key

[Get Started Free](https://visitconfirmed.com) — no credit card required. API keys are currently issued manually, so expect a short wait after signing up.

### 2. Run the connector

From any machine that has the [Medplum CLI](https://www.medplum.com/docs/cli) logged in to your project (`npx medplum login`):

```sh
npx @visitconfirmed/medplum
```

The CLI prompts for your VisitConfirmed API key, provisions the integration on your Medplum project, and registers the resulting credentials with VisitConfirmed automatically:

- An `AccessPolicy` scoped to the resources VisitConfirmed needs (Appointments, Patients, Practitioners, Locations, Communications, Tasks, Subscriptions)
- A `ClientApplication` bound to that AccessPolicy, so VisitConfirmed can write back results
- The `ClientApplication` credentials are sent to VisitConfirmed (authenticated via your API key) so write-back works automatically — no copy-paste required
- A `Subscription` on `Appointment?status=pending,proposed` that forwards new appointments to `https://visitconfirmed.com/api/medplum/fhir-appointment/`

When it finishes, you're live.

## What's in this repo

| File | Purpose |
|------|---------|
| `src/cli/` | The `npx @visitconfirmed/medplum` connector — provisions the AccessPolicy, ClientApplication, and Subscription |
| `src/bot/appointment-confirmation.ts` | Optional Medplum Bot for advanced setups that want to customize the FHIR-to-VisitConfirmed payload |
| `fhir/subscription.json` | Reference Subscription template for the Bot-based advanced setup (`endpoint: "Bot/<YOUR_BOT_ID>"`) |

## How appointment confirmation works

1. **FHIR Subscription** watches for new or updated Appointments in Medplum (`status=pending,proposed`).
2. **VisitConfirmed receives the FHIR Appointment** via direct webhook and uses the `ClientApplication` credentials to read the linked `Patient`, `Practitioner`, and `Location`.
3. **VisitConfirmed runs the multi-channel engagement:**
   - AI voice call — a real conversation that can confirm, cancel, or reschedule
   - Two-way SMS follow-up if the call goes unanswered
   - Calendar invite (.ics) delivered to the patient's phone and email
   - Automatic retries with timezone-aware quiet hours
   - Consent management and opt-out handling
   - Escalation to your staff when a patient is unreachable
   - No-show recovery for patients who miss their window
4. **FHIR write-back** — results sync back into Medplum automatically:
   - `Appointment.status` updated (`booked` for confirmed, `cancelled` for cancelled)
   - `Communication` resources logged for every patient interaction
   - `Task` resources created when staff follow-up is needed

## Advanced: customize with a Bot

Most teams use the direct-webhook flow above. If you want to run custom logic in Medplum before forwarding to VisitConfirmed (filter by location, enrich with custom extensions, route to different VisitConfirmed organizations, etc.), use the included Bot:

1. In your Medplum project, create a new Bot and paste in `src/bot/appointment-confirmation.ts` (or deploy from source — see the [Medplum Bot deployment docs](https://www.medplum.com/docs/bots)).
2. Add your VisitConfirmed API key as a Bot Secret named `VISITCONFIRMED_API_KEY`.
3. Point a Subscription at the Bot instead of the direct webhook (`endpoint: "Bot/<YOUR_BOT_ID>"`).

The Bot reads these FHIR fields from the Appointment's participant references and forwards them to VisitConfirmed:

| Field | FHIR Source | Required |
|-------|-------------|----------|
| `fhir_appointment_id` | `Appointment.id` | Yes |
| `fhir_patient_id` | `Patient.id` | No |
| `appointment_start` | `Appointment.start` | Yes |
| `appointment_end` | `Appointment.end` | No |
| `appointment_type` | `Appointment.appointmentType.coding[0].display` or `.text` | No |
| `patient_phone` | `Patient.telecom` where `system=phone` | Yes |
| `patient_first_name` | `Patient.name[0].given` | No |
| `patient_last_name` | `Patient.name[0].family` | No |
| `patient_email` | `Patient.telecom` where `system=email` | No |
| `practitioner_name` | `Practitioner.name[0]` (with prefix support for "Dr." etc.) | No |
| `location` | `Location.name` (resolved from participant reference) | No |
| `special_instructions` | `Appointment.patientInstruction` or `Appointment.comment` | No |

The Bot skips Appointments that are already in a terminal state (`booked`, `fulfilled`, `cancelled`, `noshow`), scheduled in the past, missing a Patient participant, or missing a phone number — making it safe to use with broad Subscription criteria.

## Why not build appointment reminders in-house?

The Bot is ~100 lines of TypeScript. The system behind it is not:

- **AI voice conversations** that understand real patient responses — not just IVR button presses, but natural language handling of "Can I come at 3 instead?", "I need to cancel", or "Let me check with my husband"
- **Multi-channel retry logic** that sequences voice, SMS, and staff escalation based on patient responsiveness
- **Edge case handling** for no-answer vs. wrong number vs. voicemail vs. partial confirmation vs. language barriers
- **Timezone-aware quiet hours** and consent management that comply with TCPA and healthcare communication regulations
- **Idempotent FHIR write-back** that updates Appointment status without overwriting manual changes made by your staff
- **Rescheduling workflows** that check real-time availability and book new slots
- **No-show recovery** that re-engages patients who missed their appointment window
- **Operational dashboards** and audit logging for your care team

Building this from scratch is months of engineering. VisitConfirmed is purpose-built for healthtech companies on Medplum, Canvas, and Healthie.

## Built for healthtech companies

VisitConfirmed is healthcare-native — not a generic messaging platform bolted onto FHIR. Every feature is designed around the realities of patient engagement:

- **BAA available** — sign a Business Associate Agreement before going live
- **PHI-safe defaults** — patient data is handled with healthcare-grade security
- **Consent + quiet hours built in** — TCPA-compliant from day one
- **FHIR-native architecture** — Medplum stays your system of record; VisitConfirmed adds the engagement layer

93% of patients respond. Average time to reschedule is under 60 seconds.

## Get started

[Get Started Free](https://visitconfirmed.com) — no credit card, no sales call required.

Questions? Reach us at hello@visitconfirmed.com or open an issue in this repo.

## License

Apache-2.0
