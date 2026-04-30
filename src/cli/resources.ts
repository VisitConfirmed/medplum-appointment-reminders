import type { AccessPolicy, Subscription } from '@medplum/fhirtypes';

export const VISITCONFIRMED_WEBHOOK_URL =
  'https://visitconfirmed.com/api/medplum/fhir-appointment/';

export function buildAccessPolicy(): AccessPolicy {
  return {
    resourceType: 'AccessPolicy',
    name: 'VisitConfirmed Integration',
    resource: [
      { resourceType: 'Appointment' },
      { resourceType: 'Patient', readonly: true },
      { resourceType: 'Practitioner', readonly: true },
      { resourceType: 'Location', readonly: true },
      { resourceType: 'Communication' },
      { resourceType: 'Task' },
      { resourceType: 'Subscription' },
    ],
  };
}

export function buildSubscription(visitConfirmedApiKey: string): Subscription {
  return {
    resourceType: 'Subscription',
    status: 'active',
    reason: 'VisitConfirmed appointment confirmations',
    criteria: 'Appointment?status=pending,proposed',
    channel: {
      type: 'rest-hook',
      endpoint: VISITCONFIRMED_WEBHOOK_URL,
      payload: 'application/fhir+json',
      header: [`X-Medplum-Api-Key: ${visitConfirmedApiKey}`],
    },
  };
}
