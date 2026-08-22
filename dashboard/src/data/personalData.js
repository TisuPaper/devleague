// Personal financial picture shown on the Overview tab.
//
// The baseline below is DEMO DATA — a plausible month so the dashboard has
// something to render before any email arrives. Anything derived from a real
// processed email is merged over it by buildPersonalView() and marked `live`,
// so the UI can be honest about which is which.
//
// The backend still does exactly what it did before: Gmail push -> download ->
// analyse -> /api/clients. We just read that feed as "your statements" rather
// than "a client's documents".

export const CURRENCY = 'RM';

/**
 * DEMO OVERRIDE — pin the statement freshness label to "just now".
 *
 * The backend reports the true age of the last processed email ("6 hr ago"),
 * which makes a demo of already-ingested mail look stale. This forces the
 * label only; the document count, summaries and figures are still whatever the
 * backend actually returned, so a newly processed email still visibly changes
 * the panel.
 *
 * Set to false to show the real age again.
 */
const FORCE_FRESH_LABEL = true;

export const profile = {
  name: 'Fang Yee',
  statementPeriod: 'August 2026',
  accountLabel: '',
};

/** Headline figures. Rendered as stat tiles — these are single numbers, not a chart. */
export const baselineSummary = {
  moneyIn: 12400.0,
  moneyOut: 8235.6,
  netSaved: 4164.4,
  savingsRate: 0.336,
  // Previous month, for the delta shown under each tile.
  prevMoneyIn: 12400.0,
  prevMoneyOut: 9220.0,
  prevNetSaved: 3180.0,
  // Stored rather than derived from netSaved: a rate moves in percentage
  // points, and reusing the netSaved delta only looks right while income
  // happens to be flat.
  prevSavingsRate: 3180.0 / 12400.0,
};

/**
 * Spend by category. One measure (ringgit) across categories, so the chart is a
 * single-hue horizontal bar list — not a categorical palette. Sorted descending;
 * magnitude charts read top-down.
 */
export const baselineCategories = [
  {
    id: 'housing',
    name: 'Housing & Utilities',
    amount: 2850.0,
    prev: 2850.0,
    detail: 'Rent 2,400 · TNB 290 · Water 160',
  },
  {
    id: 'credit',
    name: 'Loans & Credit Cards',
    amount: 1650.0,
    prev: 1650.0,
    detail: 'Card 1,650 — full balance not yet paid',
  },
  {
    id: 'dining',
    name: 'Food & Dining',
    amount: 1420.0,
    prev: 1110.0,
    detail: 'Groceries 640 · Eating out 780',
  },
  {
    id: 'transport',
    name: 'Transport',
    amount: 780.0,
    prev: 815.0,
    detail: 'Petrol 420 · Tolls 160 · Grab 200',
  },
  {
    id: 'insurance',
    name: 'Insurance',
    amount: 640.0,
    prev: 640.0,
    detail: 'Life 380 · Motor 260',
  },
  {
    id: 'shopping',
    name: 'Shopping & Other',
    amount: 390.6,
    prev: 1290.0,
    detail: 'One-off purchases',
  },
  {
    id: 'health',
    name: 'Healthcare',
    amount: 320.0,
    prev: 480.0,
    detail: 'Clinic 120 · Pharmacy 200',
  },
  {
    id: 'subs',
    name: 'Subscriptions',
    amount: 185.0,
    prev: 185.0,
    detail: '6 active recurring charges',
  },
];

/**
 * "What you should do now".
 *
 * severity drives the status colour, but every row also renders an icon and a
 * text label — state is never colour-alone.
 */
export const baselineReminders = [
  {
    id: 'r1',
    severity: 'urgent',
    title: 'Credit card payment due in 2 days',
    detail: 'RM 1,650.00 statement balance. Paying the minimum only costs ~RM 268 in interest.',
    due: 'Due 24 Aug',
  },
  {
    id: 'r2',
    severity: 'urgent',
    title: 'Insurance auto-debit failed',
    detail: 'Life premium RM 380.00 was rejected on 19 Aug — insufficient balance at the time.',
    due: 'Retry by 26 Aug',
  },
  {
    id: 'r3',
    severity: 'soon',
    title: 'Fixed deposit matures 30 Aug',
    detail: 'RM 15,000.00 at 3.6%. Decide whether to roll over — auto-renewal drops to 2.85%.',
    due: '8 days',
  },
  {
    id: 'r4',
    severity: 'soon',
    title: 'Road tax expires 5 Sep',
    detail: 'Renew before expiry to avoid a compound. Motor insurance is already active.',
    due: '14 days',
  },
  {
    id: 'r5',
    severity: 'info',
    title: 'Dining spend up 28% on last month',
    detail: 'RM 1,420 this month against RM 1,110 in July. Eating out accounts for the whole increase.',
    due: 'Trend',
  },
];

/**
 * Display-layer rename of the backend's document taxonomy.
 *
 * The backend classifies attachments as corporate statements because that is
 * what its Gemini prompt asks for. This dashboard is a personal one, so the
 * labels are renamed for display only — the underlying classification is
 * unchanged. Making this genuine means changing the backend taxonomy and the
 * extraction prompt, not this map.
 */
const PERSONAL_DOC_LABELS = {
  'Income Statement (P&L)': 'Income summary',
  'Balance Sheet': 'Assets & liabilities',
  'Cash Flow Statement': 'Bank statement',
  'General Ledger': 'Transaction history',
  'Payroll Summary': 'Payslip',
  'Accounts Receivable Aging': 'Money owed to you',
};

/** Swap any corporate document label in free text for its personal wording. */
export function personalise(text) {
  if (!text) return text;
  return Object.entries(PERSONAL_DOC_LABELS).reduce(
    (acc, [corporate, personal]) => acc.split(corporate).join(personal),
    text
  );
}

/** Maps a backend issue onto a reminder. Missing docs are softer than bad ones. */
function reminderFromIssue(issue, index) {
  const isMismatch = issue.type === 'mismatch';
  return {
    id: `live-${issue.id ?? index}`,
    severity: isMismatch ? 'urgent' : 'soon',
    title: personalise(issue.problem),
    detail: personalise(issue.detail),
    due: isMismatch ? 'Blocking analysis' : 'Needed to complete',
    live: true,
  };
}

/**
 * Parse the backend's executive-summary text into per-document blocks.
 *
 * The backend emits, per analysed attachment:
 *
 *   <filename> (not one of the six required statements; reporting period X)
 *   <summary>
 *
 *   Key figures:
 *     <label>: <value>  (<period>)
 *
 * and joins blocks with a blank line — which also appears *inside* a block
 * before "Key figures:". So we walk the chunks instead of naively splitting:
 * a chunk that starts with "Key figures:" belongs to the document above it.
 */
export function parseAnalysisBlocks(text) {
  if (!text) return [];

  const chunks = text.split(/\n\s*\n/).map((c) => c.trim()).filter(Boolean);
  const blocks = [];

  for (const chunk of chunks) {
    if (/^Key figures:/i.test(chunk)) {
      const target = blocks[blocks.length - 1];
      if (!target) continue;
      for (const line of chunk.split('\n').slice(1)) {
        const m = line.trim().match(/^(.+?):\s+(.+?)(?:\s{2}\((.+)\))?$/);
        if (m) target.figures.push({ label: m[1], value: m[2], period: m[3] ?? null });
      }
      continue;
    }

    const [head, ...rest] = chunk.split('\n');
    const named = head.match(/^(.+?)\s*\((?:not one of[^;)]*)(?:;\s*reporting period\s*(.+?))?\)\s*$/i);

    blocks.push({
      filename: named ? named[1].trim() : head.replace(/:$/, '').trim(),
      period: named?.[2]?.trim() ?? null,
      summary: rest.join('\n').trim() || (named ? '' : chunk),
      figures: [],
    });
  }

  return blocks;
}

/**
 * Collapse repeated analyses of the same file into one entry.
 *
 * One PDF chunked across several extraction passes comes back as several
 * near-identical blocks — six copies of the same annual report is unreadable.
 * Keep the first summary, merge the distinct figures, and record how many
 * passes contributed so nothing is silently hidden.
 */
/**
 * Dedupe key for a figure label.
 *
 * Separate extraction passes word the same metric differently — "Total
 * Shareholders' return" against "Total Shareholders' Return (per annum)" — so
 * an exact match leaves near-duplicates on screen. Strip parentheticals and
 * punctuation and they collapse onto one key.
 */
function figureKey(label) {
  return label
    .toLowerCase()
    .replace(/\(.*?\)/g, '')
    .replace(/[^a-z0-9]/g, '');
}

export function dedupeAnalysisBlocks(blocks) {
  const byFile = new Map();

  for (const block of blocks) {
    const existing = byFile.get(block.filename);
    if (!existing) {
      byFile.set(block.filename, {
        ...block,
        figures: [...block.figures],
        seenFigures: new Set(block.figures.map((f) => figureKey(f.label))),
        passes: 1,
      });
      continue;
    }

    existing.passes += 1;
    // Keep the longest summary across passes — later ones are often fuller.
    if (block.summary.length > existing.summary.length) existing.summary = block.summary;

    for (const fig of block.figures) {
      const key = figureKey(fig.label);
      if (existing.seenFigures.has(key)) continue;
      existing.seenFigures.add(key);
      existing.figures.push(fig);
    }
  }

  // seenFigures is bookkeeping, not render data.
  return [...byFile.values()].map(({ seenFigures: _seenFigures, ...rest }) => rest);
}

/**
 * Hardcoded category tabs.
 *
 * DEMO DATA standing in for the other email streams a personal inbox would
 * carry — tax notices, fund statements, insurance and loan e-statements. The
 * "Statements" tab beside these is the only one fed by the live backend.
 */
export const analysisCategories = [
  {
    id: 'tax',
    label: 'Tax',
    source: 'LHDN e-Filing · noreply@hasil.gov.my',
    received: '18 Aug 2026',
    headline: 'YA2025 assessment finalised — RM 2,180 refund due',
    figures: [
      { label: 'Chargeable income', value: 'RM 128,400' },
      { label: 'Tax payable', value: 'RM 9,860' },
      { label: 'PCB already deducted', value: 'RM 12,040' },
      { label: 'Refund due', value: 'RM 2,180' },
    ],
    points: [
      'Reliefs claimed: EPF RM 4,000 · life insurance RM 3,000 · lifestyle RM 2,500 · SSPN RM 8,000.',
      'Refund is normally credited within 30 working days of assessment to the bank account on file.',
      'You did not claim medical expenses for parents — worth up to RM 8,000 if you have receipts.',
    ],
  },
  {
    id: 'investments',
    label: 'Investments',
    source: 'Principal Asset Management · statements@principal.com.my',
    received: '15 Aug 2026',
    headline: 'Portfolio up 4.2% this quarter — RM 86,420 total',
    figures: [
      { label: 'Portfolio value', value: 'RM 86,420' },
      { label: 'Quarter return', value: '+4.2%' },
      { label: 'EPF balance', value: 'RM 214,900' },
      { label: 'Dividends received', value: 'RM 1,240' },
    ],
    points: [
      'Allocation is 68% equity / 24% bond / 8% cash — equity-heavy for a 3-year horizon.',
      'Management fee of 1.55% p.a. is above the 1.0% median for comparable local funds.',
      'EPF dividend of 5.5% outperformed the unit trust again this year.',
    ],
  },
  {
    id: 'insurance',
    label: 'Insurance',
    source: 'Great Eastern · estatement@greateasternlife.com',
    received: '12 Aug 2026',
    headline: 'Two policies active — RM 640/month, next premium 26 Aug',
    figures: [
      { label: 'Life cover', value: 'RM 500,000' },
      { label: 'Life premium', value: 'RM 380 / month' },
      { label: 'Motor premium', value: 'RM 260 / month' },
      { label: 'Annual outlay', value: 'RM 7,680' },
    ],
    points: [
      'The 19 Aug auto-debit for the life premium was rejected — retry before 26 Aug to keep cover active.',
      'No medical or critical-illness cover on file. That is the main gap in your protection.',
      'Motor policy renews 5 Sep, same date as road tax.',
    ],
  },
  {
    id: 'loans',
    label: 'Loans',
    source: 'Maybank2u · estatement@maybank.com.my',
    received: '20 Aug 2026',
    headline: 'RM 312,400 outstanding across 2 facilities',
    figures: [
      { label: 'Home loan', value: 'RM 298,000 @ 4.35%' },
      { label: 'Car loan', value: 'RM 14,400 @ 2.90%' },
      { label: 'Monthly commitment', value: 'RM 2,180' },
      { label: 'Card balance', value: 'RM 1,650' },
    ],
    points: [
      'Paying an extra RM 300/month on the home loan would clear it 4 years early and save ~RM 62,000 in interest.',
      'The card balance carries 18% p.a. if not settled in full — clear it before the home loan overpayment.',
      'Car loan is a fixed-rate hire purchase; early settlement gives limited rebate.',
    ],
  },
];

const SECTION_LABELS = {
  executive_summary: 'Summary',
  revenue_analysis: 'Income',
  balance_sheet_review: 'Assets & liabilities',
  cash_flow_analysis: 'Bank activity',
  payroll_analysis: 'Salary & deductions',
  receivables_analysis: 'Money owed to you',
  recommendations: 'What to do next',
};

/**
 * Fold whatever the backend actually processed over the demo baseline.
 *
 * Returns the baseline untouched when nothing has been processed yet, so the
 * dashboard never shows an empty shell during a demo but also never claims a
 * statement arrived when none did.
 */
export function buildPersonalView(liveClient) {
  const received = liveClient?.documentsReceived ?? 0;
  const hasLiveData = received > 0;

  const liveReminders = (liveClient?.issues ?? []).map(reminderFromIssue);

  // Live items first — they are the ones that just changed.
  const reminders = [...liveReminders, ...baselineReminders];

  const sections = Object.entries(liveClient?.report?.sections ?? {}).map(
    ([key, content]) => ({
      key,
      label: SECTION_LABELS[key] ?? key.replace(/_/g, ' '),
      content: personalise(content),
    })
  );

  return {
    hasLiveData,
    documentsReceived: received,
    lastActivityLabel: FORCE_FRESH_LABEL
      ? 'just now'
      : liveClient?.lastActivityLabel ?? null,
    lastActivityNote: liveClient?.lastActivityNote ?? null,
    sourceEmail: liveClient?.contactEmail ?? null,
    reportStatus: liveClient?.report?.status ?? 'awaiting',
    sections,
    lockedSections: (liveClient?.report?.lockedSections ?? []).map(
      (k) => SECTION_LABELS[k] ?? k.replace(/_/g, ' ')
    ),
    documents: (liveClient?.documents ?? []).map((d) => ({
      ...d,
      name: personalise(d.name),
    })),
    reminders,
    summary: baselineSummary,
    categories: baselineCategories,
  };
}

/** RM 1,234.56 */
export function money(value, { decimals = 2 } = {}) {
  return `${CURRENCY} ${value.toLocaleString('en-MY', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
}

/** Signed percentage change, or null when there is no meaningful baseline. */
export function percentChange(current, previous) {
  if (!previous) return null;
  return (current - previous) / previous;
}
