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
│    triggers Bot      │               │  Quiet Hours & Consent    │
│                      │  ◄────────────┤  Escalation to Staff      │
│  Appointment.status  │  FHIR write-  │  Rescheduling Workflows   │
│  Communication       │  back         │  No-Show Recovery         │
│  Task (escalation)   │               │                           │
└──────────────────────┘               └───────────────────────────┘
```

This open-source Medplum Bot triggers automatically when a new Appointment is created. It resolves the Patient, Practitioner, and Location from FHIR references, then calls the VisitConfirmed API. VisitConfirmed handles the rest: AI voice calls that have real conversations with patients, SMS follow-ups, calendar invites, retry logic, quiet hours, consent management, and escalation to your staff when needed. Results are written back to Medplum as FHIR resources.

**Setup time: ~5 minutes.** No infrastructure to manage.

## What's in this repo

| File | Purpose |
|------|---------|
| `src/appointment-confirmation-bot.ts` | Medplum Bot — triggers on new Appointments, resolves FHIR references, calls VisitConfirmed |
| `fhir/subscription.json` | FHIR Subscription config (fires on `Appointment?status=pending,proposed`) |

## Quick start

### 1. Get a VisitConfirmed API key

[Get Started Free](https://visitconfirmed.com) — no credit card required. API keys are currently issued manually, so expect a short wait after signing up.

### 2. Create the Bot in Medplum

1. In your Medplum project, go to **Bots** and create a new Bot.
2. Copy the code from `src/appointment-confirmation-bot.ts` into the Bot editor, or deploy from source using the [Medplum Bot deployment docs](https://www.medplum.com/docs/bots).
3. Add your API key as a Bot Secret:
   - **Key:** `VISITCONFIRMED_API_KEY`
   - **Value:** your API key from step 1

### 3. Create the FHIR Subscription

1. Go to your Medplum project's **Subscriptions**.
2. Create a new Subscription using `fhir/subscription.json` as a template.
3. Replace `<YOUR_BOT_ID>` in the endpoint with your Bot's ID.

That's it. New Appointments with status `pending` or `proposed` will automatically trigger patient outreach, and results are written back to Medplum as FHIR resources.

## How appointment confirmation works

1. **FHIR Subscription** watches for new or updated Appointments in Medplum.
2. **This Bot** fires automatically, resolves the `Patient`, `Practitioner`, and `Location` from FHIR participant references, extracts contact details, and sends the engagement to VisitConfirmed.
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

## FHIR resources the Bot reads

The Bot resolves these FHIR resources from the Appointment's participant references:

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

## Guard clauses

The Bot skips Appointments that are:
- Already in a terminal state: `booked`, `fulfilled`, `cancelled`, or `noshow`
- Scheduled in the past (compares `Appointment.start` to current time)
- Missing a Patient participant reference
- Missing a phone number on the Patient resource

These guards make the Bot safe to use with broad Subscription criteria — it will only engage patients for actionable future appointments.

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

MIT
