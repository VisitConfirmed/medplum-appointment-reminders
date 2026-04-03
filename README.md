# Medplum Appointment Reminders by VisitConfirmed

FHIR-native appointment confirmation for Medplum. AI voice calls + SMS reminders to reduce no-shows — without building your own engagement system.

```
Medplum                             VisitConfirmed
┌────────────────┐                  ┌──────────────────────┐
│                │                  │                      │
│  Appointment   │                  │  AI Voice Call       │
│    created     │                  │  SMS Reminders       │
│       │        │                  │  Calendar Invites    │
│       ▼        │     webhook      │  Retry Logic         │
│  Subscription  ├─────────────────►│  Escalation          │
│    + Bot       │                  │  Quiet Hours         │
│                │  ◄───────────────┤  FHIR Write-back     │
│  Appointment   │   status update  │                      │
│    updated     │                  └──────────────────────┘
└────────────────┘
```

When a new Appointment is created in Medplum, this Bot fires automatically. It fetches the Patient's contact details and calls the VisitConfirmed API. VisitConfirmed then handles the hard part: AI voice calls, SMS follow-ups, retry logic, quiet hours, consent management, and escalation to staff when needed.

**Setup time: ~5 minutes.**

## What's in this repo

| File | Purpose |
|------|---------|
| `src/appointment-confirmation-bot.ts` | Medplum Bot that triggers on new Appointments |
| `fhir/subscription.json` | FHIR Subscription config (fires on `Appointment?status=pending,proposed`) |

## Quick start

### 1. Get a VisitConfirmed API key

[Start a free pilot](https://visitconfirmed.com/start-pilot) — no credit card required. You'll receive an API key for your organization.

### 2. Create the Bot in Medplum

1. In your Medplum project, go to **Bots** and create a new Bot.
2. Copy the code from `src/appointment-confirmation-bot.ts` into the Bot editor (or deploy from source — see [Medplum Bot docs](https://www.medplum.com/docs/bots)).
3. Add your API key as a Bot Secret:
   - **Key:** `VISITCONFIRMED_API_KEY`
   - **Value:** your API key from step 1

### 3. Create the Subscription

1. Go to your Medplum project's **Subscriptions**.
2. Create a new Subscription using `fhir/subscription.json` as a template.
3. Replace `<YOUR_BOT_ID>` in the endpoint with your Bot's ID.

That's it. New Appointments with status `pending` or `proposed` will automatically trigger VisitConfirmed outreach.

## How it works

1. **Medplum Subscription** watches for new or updated Appointments.
2. **This Bot** fires, fetches the Patient and Practitioner from FHIR references, and sends the details to VisitConfirmed.
3. **VisitConfirmed** runs the engagement:
   - AI voice call to confirm, cancel, or reschedule
   - SMS follow-up if the call goes unanswered
   - Calendar invite (.ics) sent to the patient's phone
   - Automatic retries with configurable quiet hours
   - Escalation to your staff when a patient is unresponsive
4. **Results written back** to Medplum as FHIR resources — Appointment status updates (confirmed → `booked`, cancelled → `cancelled`), Communication logs, and Task resources for staff escalations.

## What the Bot sends

The Bot extracts these fields from FHIR resources and sends them to the VisitConfirmed API:

| Field | FHIR Source | Required |
|-------|-------------|----------|
| `fhir_appointment_id` | `Appointment.id` | Yes |
| `fhir_patient_id` | `Patient.id` | No |
| `appointment_start` | `Appointment.start` | Yes |
| `appointment_end` | `Appointment.end` | No |
| `appointment_type` | `Appointment.appointmentType` | No |
| `patient_phone` | `Patient.telecom` (system=phone) | Yes |
| `patient_first_name` | `Patient.name[0].given` | No |
| `patient_last_name` | `Patient.name[0].family` | No |
| `patient_email` | `Patient.telecom` (system=email) | No |
| `practitioner_name` | `Practitioner.name[0]` | No |
| `location` | `Location.name` (from participant) | No |
| `special_instructions` | `Appointment.patientInstruction` or `.comment` | No |

## Guard clauses

The Bot skips Appointments that are:
- Already confirmed (`booked`), completed (`fulfilled`), cancelled, or no-show
- In the past

## Why not build this in-house?

The Bot is ~100 lines. The iceberg underneath is not:

- Reliable AI voice conversations that handle real patient responses
- Retry logic across channels (voice &rarr; SMS &rarr; escalation)
- Handling no-answer vs. wrong number vs. voicemail vs. partial confirmation
- Timezone-aware quiet hours and consent management
- Idempotent FHIR write-back that doesn't overwrite human changes
- Operational dashboards and audit logging
- Edge cases: reschedules, cancellations, language preferences, caregiver routing

This is months of work. VisitConfirmed has already built it.

## Pricing

| Tier | Price | Appointments/month | Channels |
|------|-------|--------------------|----------|
| Pilot | Free (30 days) | 500 | SMS, Email |
| Growth | $399/mo | 1,000 | SMS, Email |
| Scale | $999/mo | 5,000 | SMS, Email, Voice |
| Enterprise | Custom | 5,000+ | All channels |

[Start your free pilot &rarr;](https://visitconfirmed.com/start-pilot)

## Support

- **Docs:** [visitconfirmed.com/docs](https://visitconfirmed.com/docs)
- **Email:** support@visitconfirmed.com
- **Issues:** Open an issue in this repo

## License

MIT
