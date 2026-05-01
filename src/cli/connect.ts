import { MedplumClient, createReference } from '@medplum/core';
import type {
  AccessPolicy,
  ClientApplication,
  Reference,
  Subscription,
} from '@medplum/fhirtypes';

import { FileSystemStorage } from './medplum-auth';
import { prompt } from './prompts';
import {
  VISITCONFIRMED_REGISTER_URL,
  VISITCONFIRMED_WEBHOOK_URL,
  buildAccessPolicy,
  buildSubscription,
} from './resources';

interface AuthMeResponse {
  project?: { resourceType: 'Project'; id?: string };
}

type RegistrationResult =
  | { ok: true }
  | { ok: false; status?: number; reason: string };

function fail(message: string): never {
  console.error(`\n${message}`);
  process.exit(1);
}

function toFhirBaseUrl(baseUrl: string): string {
  const trimmed = baseUrl.replace(/\/+$/, '');
  return trimmed.endsWith('/fhir/R4') ? trimmed : `${trimmed}/fhir/R4`;
}

async function getProjectId(medplum: MedplumClient): Promise<string> {
  let me: AuthMeResponse;
  try {
    me = await medplum.get<AuthMeResponse>('auth/me');
  } catch (err) {
    const status = (err as { status?: number; outcome?: unknown })?.status;
    if (status === 401 || status === 403) {
      fail('Medplum session expired. Run: npx medplum login');
    }
    fail(`Could not reach Medplum: ${(err as Error).message ?? err}`);
  }
  const projectId = me?.project?.id;
  if (!projectId) {
    fail(
      'Could not determine your Medplum project. ' +
        'Make sure your CLI login is bound to a project.'
    );
  }
  return projectId;
}

async function createClientApplication(
  medplum: MedplumClient,
  projectId: string,
  accessPolicy: AccessPolicy & { id: string }
): Promise<ClientApplication & { id: string; secret: string }> {
  const body = {
    name: 'VisitConfirmed',
    description: 'Appointment confirmation integration by VisitConfirmed',
    accessPolicy: createReference(accessPolicy) satisfies Reference<AccessPolicy>,
  };
  try {
    return await medplum.post<ClientApplication & { id: string; secret: string }>(
      `admin/projects/${projectId}/client`,
      body
    );
  } catch (err) {
    const status = (err as { status?: number })?.status;
    if (status === 403) {
      fail(
        'Need project admin access to create ClientApplications. ' +
          'Ask a project owner to run this command, or grant your user admin rights.'
      );
    }
    throw err;
  }
}

async function registerClientApplication(
  visitConfirmedApiKey: string,
  fhirBaseUrl: string,
  clientId: string,
  clientSecret: string
): Promise<RegistrationResult> {
  try {
    const response = await fetch(VISITCONFIRMED_REGISTER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Medplum-Api-Key': visitConfirmedApiKey,
      },
      body: JSON.stringify({
        medplum_base_url: fhirBaseUrl,
        medplum_client_id: clientId,
        medplum_client_secret: clientSecret,
      }),
    });
    if (response.ok) {
      return { ok: true };
    }
    const detail = await response.text().catch(() => '');
    const reason =
      response.status === 403
        ? 'Invalid VisitConfirmed API key.'
        : `HTTP ${response.status}${detail ? `: ${detail.slice(0, 200)}` : ''}`;
    return { ok: false, status: response.status, reason };
  } catch (err) {
    return {
      ok: false,
      reason: `Network error: ${(err as Error).message ?? err}`,
    };
  }
}

function printManualFallback(
  client: { id: string; secret: string },
  fhirBaseUrl: string,
  reason: string
): void {
  console.log('\n----------------------------------------------------------------');
  console.log('Could not auto-register with VisitConfirmed.');
  console.log(`Reason: ${reason}`);
  console.log('----------------------------------------------------------------');
  console.log(
    '\nYour Medplum AccessPolicy and ClientApplication were created, but the'
  );
  console.log(
    'Subscription was NOT created — VisitConfirmed cannot enrich appointments'
  );
  console.log('without the credentials below.\n');
  console.log('To finish setup manually, share these with VisitConfirmed support:');
  console.log(`  Client ID:     ${client.id}`);
  console.log(`  Client Secret: ${client.secret}`);
  console.log(`  Base URL:      ${fhirBaseUrl}`);
  console.log(
    '\nThen contact support@visitconfirmed.com so the Subscription can be ' +
      'created on your behalf, or re-run this command after fixing the issue ' +
      'above.\n'
  );
}

export async function connect(): Promise<void> {
  const pkg = require('../../package.json') as { name: string; version: string };
  console.log(`\n${pkg.name} v${pkg.version}`);
  console.log('Provision the VisitConfirmed integration on your Medplum project.\n');

  const visitConfirmedApiKey = await prompt('VisitConfirmed API key', {
    required: true,
  });
  const baseUrl = await prompt('Medplum base URL', {
    defaultValue: 'https://api.medplum.com',
  });
  const profile = await prompt('Medplum CLI profile', {
    defaultValue: 'default',
  });

  const storage = new FileSystemStorage(profile);
  if (!storage.profileExists()) {
    fail(
      `No Medplum login found at ~/.medplum/${profile}.json. ` +
        'Run: npx medplum login'
    );
  }

  const medplum = new MedplumClient({ baseUrl, storage });
  const fhirBaseUrl = toFhirBaseUrl(baseUrl);

  console.log('\nValidating Medplum session...');
  const projectId = await getProjectId(medplum);
  console.log(`  Project: ${projectId}`);

  console.log('\nCreating AccessPolicy...');
  let accessPolicy: AccessPolicy & { id: string };
  try {
    accessPolicy = await medplum.createResource<AccessPolicy>(
      buildAccessPolicy()
    ) as AccessPolicy & { id: string };
  } catch (err) {
    const status = (err as { status?: number })?.status;
    if (status === 403) {
      fail('Need project admin access to create AccessPolicies.');
    }
    throw err;
  }
  console.log(`  AccessPolicy/${accessPolicy.id}`);

  console.log('\nCreating ClientApplication...');
  const client = await createClientApplication(medplum, projectId, accessPolicy);
  console.log(`  ClientApplication/${client.id}`);

  console.log('\nRegistering with VisitConfirmed...');
  const registration = await registerClientApplication(
    visitConfirmedApiKey,
    fhirBaseUrl,
    client.id,
    client.secret
  );
  if (!registration.ok) {
    printManualFallback(client, fhirBaseUrl, registration.reason);
    process.exit(1);
  }
  console.log('  Registered successfully.');

  console.log('\nCreating Subscription...');
  let subscription: Subscription & { id: string };
  try {
    subscription = await medplum.createResource<Subscription>(
      buildSubscription(visitConfirmedApiKey)
    ) as Subscription & { id: string };
  } catch (err) {
    const status = (err as { status?: number })?.status;
    if (status === 403) {
      fail('Need permissions to create Subscriptions.');
    }
    throw err;
  }
  console.log(`  Subscription/${subscription.id} -> ${VISITCONFIRMED_WEBHOOK_URL}`);

  console.log('\n----------------------------------------------------------------');
  console.log("Done! You're live.");
  console.log('----------------------------------------------------------------');
  console.log('Created on your Medplum project:');
  console.log(`  AccessPolicy/${accessPolicy.id}`);
  console.log(`  ClientApplication/${client.id}`);
  console.log(`  Subscription/${subscription.id}`);
  console.log(
    '\nNew Appointments with status pending or proposed will now flow to'
  );
  console.log(
    'VisitConfirmed automatically. Results are written back to your Medplum'
  );
  console.log('project as FHIR resources.\n');
}
