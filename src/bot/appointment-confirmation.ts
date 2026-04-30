/**
 * Medplum Bot: Appointment Confirmation via VisitConfirmed
 *
 * Triggered by a Medplum Subscription when an Appointment is created or
 * updated. Fetches the Patient, extracts contact details, and calls the
 * VisitConfirmed API to start an engagement (AI voice call + SMS).
 *
 * Setup:
 *   1. Deploy this Bot in your Medplum project.
 *   2. Create a Subscription that fires on Appointment create/update.
 *   3. Add your VisitConfirmed API key as a Bot Secret named
 *      VISITCONFIRMED_API_KEY.
 *
 * See README.md for full setup instructions.
 */

import { BotEvent, MedplumClient } from '@medplum/core';
import { Appointment, Location, Patient, Practitioner } from '@medplum/fhirtypes';

const VISITCONFIRMED_API_URL =
  'https://api.visitconfirmed.com/api/medplum/engagements/';

export async function handler(
  medplum: MedplumClient,
  event: BotEvent<Appointment>
): Promise<void> {
  const appointment = event.input;

  // --- Guard clauses ---

  // Skip appointments that are already confirmed or completed.
  if (
    appointment.status === 'booked' ||
    appointment.status === 'fulfilled' ||
    appointment.status === 'cancelled' ||
    appointment.status === 'noshow'
  ) {
    console.log(
      `Skipping appointment ${appointment.id}: status is ${appointment.status}`
    );
    return;
  }

  // Skip appointments in the past.
  if (appointment.start && new Date(appointment.start) < new Date()) {
    console.log(`Skipping appointment ${appointment.id}: already in the past`);
    return;
  }

  // --- Resolve Patient ---

  const patientRef = appointment.participant?.find((p) =>
    p.actor?.reference?.startsWith('Patient/')
  )?.actor?.reference;

  if (!patientRef) {
    console.log(
      `Skipping appointment ${appointment.id}: no Patient participant`
    );
    return;
  }

  const patient = (await medplum.readReference({
    reference: patientRef,
  })) as Patient;

  // Phone is required — skip if the patient has no phone on file.
  const phone = patient.telecom?.find((t) => t.system === 'phone')?.value;
  if (!phone) {
    console.log(
      `Skipping appointment ${appointment.id}: patient ${patient.id} has no phone`
    );
    return;
  }

  // --- Resolve Practitioner (optional) ---

  const practitionerRef = appointment.participant?.find((p) =>
    p.actor?.reference?.startsWith('Practitioner/')
  )?.actor?.reference;

  let practitionerName = '';
  if (practitionerRef) {
    try {
      const practitioner = (await medplum.readReference({
        reference: practitionerRef,
      })) as Practitioner;
      const name = practitioner.name?.[0];
      if (name) {
        const given = name.given?.join(' ') ?? '';
        const prefix = name.prefix?.join(' ') ?? '';
        practitionerName = prefix
          ? `${prefix} ${given} ${name.family ?? ''}`.trim()
          : `${given} ${name.family ?? ''}`.trim();
      }
    } catch {
      console.log(`Could not resolve practitioner: ${practitionerRef}`);
    }
  }

  // --- Resolve Location (optional) ---

  const locationRef = appointment.participant?.find((p) =>
    p.actor?.reference?.startsWith('Location/')
  )?.actor?.reference;

  let locationName = '';
  if (locationRef) {
    try {
      const location = (await medplum.readReference({
        reference: locationRef,
      })) as Location;
      locationName = location.name ?? '';
    } catch {
      console.log(`Could not resolve location: ${locationRef}`);
    }
  }

  // --- Build payload ---

  const patientName = patient.name?.[0];
  const email = patient.telecom?.find((t) => t.system === 'email')?.value;

  const payload: Record<string, string> = {
    fhir_appointment_id: appointment.id ?? '',
    fhir_patient_id: patient.id ?? '',
    appointment_start: appointment.start ?? '',
    appointment_end: appointment.end ?? '',
    appointment_type:
      appointment.appointmentType?.coding?.[0]?.display ??
      appointment.appointmentType?.text ??
      'general',
    patient_first_name: patientName?.given?.join(' ') ?? '',
    patient_last_name: patientName?.family ?? '',
    patient_phone: phone,
    patient_email: email ?? '',
    practitioner_name: practitionerName,
    location: locationName,
    special_instructions: appointment.patientInstruction ?? appointment.comment ?? '',
  };

  // --- Call VisitConfirmed API ---

  const apiKey = event.secrets['VISITCONFIRMED_API_KEY']?.valueString;
  if (!apiKey) {
    console.error(
      'VISITCONFIRMED_API_KEY secret is not configured. ' +
        'Add it in Medplum Project Admin > Secrets.'
    );
    return;
  }

  const response = await fetch(VISITCONFIRMED_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Medplum-Api-Key': apiKey,
    },
    body: JSON.stringify(payload),
  });

  const result = await response.json();

  if (!response.ok) {
    console.error(
      `VisitConfirmed API error (${response.status}):`,
      JSON.stringify(result)
    );
    return;
  }

  console.log(
    `VisitConfirmed engagement created for appointment ${appointment.id}:`,
    JSON.stringify(result)
  );
}
