// The real (backend-driven) client shown alongside the demo records.
//
// Everything the dashboard displays for this client comes from the backend's
// /api/clients response, which is derived only from email it actually
// processed. The shell below is what shows BEFORE the first email arrives --
// deliberately an empty "awaiting documents" state that asserts nothing, so
// the client has a home in the UI that later fills in with real analysis.

import { REQUIRED_DOCUMENTS } from './mockData';

export const LIVE_CLIENT_DOMAIN =
  import.meta.env.VITE_LIVE_CLIENT_DOMAIN ?? 'n2nconnect.com';

const LIVE_CLIENT_NAME =
  import.meta.env.VITE_LIVE_CLIENT_NAME ?? 'N2NConnect Sdn Bhd';

const ALL_REPORT_SECTIONS = [
  'executive_summary',
  'revenue_analysis',
  'balance_sheet_review',
  'cash_flow_analysis',
  'payroll_analysis',
  'receivables_analysis',
  'recommendations',
];

/** Empty state for the live client: no documents, no analysis, nothing invented. */
export function buildLiveClientShell() {
  return {
    id: LIVE_CLIENT_DOMAIN.replace(/\./g, '-'),
    domain: LIVE_CLIENT_DOMAIN,
    companyName: LIVE_CLIENT_NAME,
    industry: 'Financial Technology',
    contactEmail: `finance@${LIVE_CLIENT_DOMAIN}`,
    status: 'pending',
    isLive: true,
    awaitingFirstEmail: true,
    lastActivityTimestamp: Date.now(),
    lastActivityLabel: 'awaiting email',
    lastActivityNote: 'No documents received yet — send an email to begin processing.',
    documents: REQUIRED_DOCUMENTS.map((name, i) => ({
      id: `d${i + 1}`,
      name,
      type: null,
      submitted: null,
      status: 'missing',
    })),
    issues: [],
    report: {
      status: 'awaiting',
      title: 'Financial Analysis Report',
      readySections: [],
      lockedSections: ALL_REPORT_SECTIONS,
      sections: {},
    },
    activity: [],
    documentsReceived: 0,
  };
}

/**
 * Merge the backend's processed clients into the demo client list.
 *
 * Live clients replace the shell once real data exists and are flagged with
 * isLive so the UI can distinguish them from the demo records. Demo records
 * are passed through untouched.
 */
export function mergeLiveClients(demoClients, liveClients) {
  const live = (liveClients || []).map(c => ({ ...c, isLive: true }));
  const hasLiveTarget = live.some(c => c.domain === LIVE_CLIENT_DOMAIN);

  const combined = [
    ...live,
    ...(hasLiveTarget ? [] : [buildLiveClientShell()]),
    ...demoClients,
  ];

  return combined.sort(
    (a, b) => (b.lastActivityTimestamp || 0) - (a.lastActivityTimestamp || 0)
  );
}
