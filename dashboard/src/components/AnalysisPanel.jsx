import React, { useMemo, useState } from 'react';
import { Mail, Inbox, FileText, Lock, ChevronDown, Layers } from 'lucide-react';
import {
  analysisCategories,
  parseAnalysisBlocks,
  dedupeAnalysisBlocks,
} from '../data/personalData';
import './AnalysisPanel.css';

// How much of a long summary to show before the reader has to ask for more.
const PREVIEW_CHARS = 260;
// A dozen figure tiles is a wall. Show the headline few, keep the rest a click away.
const PREVIEW_FIGURES = 4;

/** One analysed attachment: summary, key figures, expandable. */
const DocumentBlock = ({ block }) => {
  const [open, setOpen] = useState(false);
  const [allFigures, setAllFigures] = useState(false);
  const long = block.summary.length > PREVIEW_CHARS;
  const shown = open || !long ? block.summary : `${block.summary.slice(0, PREVIEW_CHARS).trimEnd()}…`;

  const figures = allFigures ? block.figures : block.figures.slice(0, PREVIEW_FIGURES);
  const moreFigures = block.figures.length - figures.length;

  return (
    <article className="doc">
      <header className="doc-head">
        <FileText size={12} />
        <span className="doc-name">{block.filename}</span>
        {block.period && <span className="doc-period">{block.period}</span>}
        {block.passes > 1 && (
          <span className="doc-passes" title="Merged from repeated extraction passes">
            {block.passes}×
          </span>
        )}
      </header>

      <p className="doc-summary">{shown}</p>

      {long && (
        <button type="button" className="doc-more" onClick={() => setOpen((v) => !v)}>
          {open ? 'Show less' : 'Read more'}
        </button>
      )}

      {figures.length > 0 && (
        <>
          <dl className="doc-figures">
            {figures.map((f, i) => (
              <div key={`${f.label}-${i}`}>
                <dt>{f.label}</dt>
                <dd>
                  {f.value}
                  {f.period && <em>{f.period}</em>}
                </dd>
              </div>
            ))}
          </dl>
          {(moreFigures > 0 || allFigures) && (
            <button
              type="button"
              className="doc-more"
              onClick={() => setAllFigures((v) => !v)}
            >
              {allFigures ? 'Fewer figures' : `+${moreFigures} more figures`}
            </button>
          )}
        </>
      )}
    </article>
  );
};

/** A hardcoded category: headline, figures, findings. */
const CategoryView = ({ category }) => (
  <div className="cat">
    <div className="cat-source">
      <Mail size={13} />
      <div>
        <span className="cat-source-main">{category.source}</span>
        <span className="cat-source-time">Received {category.received}</span>
      </div>
    </div>

    <p className="cat-headline">{category.headline}</p>

    <dl className="doc-figures">
      {category.figures.map((f) => (
        <div key={f.label}>
          <dt>{f.label}</dt>
          <dd>{f.value}</dd>
        </div>
      ))}
    </dl>

    <ul className="cat-points">
      {category.points.map((p, i) => (
        <li key={i}>{p}</li>
      ))}
    </ul>
  </div>
);

/** Live backend analysis, parsed and collapsed. */
const StatementsView = ({ view }) => {
  const [openSection, setOpenSection] = useState(null);

  const summarySection = view.sections.find((s) => s.key === 'executive_summary');
  const otherSections = view.sections.filter((s) => s.key !== 'executive_summary');

  const blocks = useMemo(
    () => dedupeAnalysisBlocks(parseAnalysisBlocks(summarySection?.content)),
    [summarySection]
  );

  if (!view.hasLiveData) {
    return (
      <div className="an-empty">
        <Inbox size={20} />
        <p className="an-empty-title">No statement processed yet</p>
        <p className="an-empty-detail">
          Forward a bank or card statement to the connected inbox. It is downloaded,
          redacted, analysed, and appears here automatically.
        </p>
      </div>
    );
  }

  return (
    <div className="cat">
      <div className="cat-source">
        <Mail size={13} />
        <div>
          <span className="cat-source-main">
            {view.documentsReceived} document{view.documentsReceived === 1 ? '' : 's'} analysed
            {view.sourceEmail ? ` · ${view.sourceEmail}` : ''}
          </span>
          {view.lastActivityLabel && (
            <span className="cat-source-time">Updated {view.lastActivityLabel}</span>
          )}
        </div>
      </div>

      {blocks.map((b) => (
        <DocumentBlock key={b.filename} block={b} />
      ))}

      {otherSections.length > 0 && (
        <div className="an-sections">
          {otherSections.map((s) => {
            const open = openSection === s.key;
            return (
              <div key={s.key} className={`an-section ${open ? 'open' : ''}`}>
                <button
                  type="button"
                  className="an-section-head"
                  onClick={() => setOpenSection(open ? null : s.key)}
                  aria-expanded={open}
                >
                  <ChevronDown size={13} className="an-chevron" />
                  <span>{s.label}</span>
                </button>
                {open && <p className="an-section-body">{s.content}</p>}
              </div>
            );
          })}
        </div>
      )}

      {view.lockedSections.length > 0 && (
        <p className="an-locked">
          <Lock size={11} /> Not yet available: {view.lockedSections.join(', ')}
        </p>
      )}
    </div>
  );
};

const AnalysisPanel = ({ view }) => {
  const [active, setActive] = useState('statements');

  const tabs = [
    { id: 'statements', label: 'Statements', live: true },
    ...analysisCategories.map((c) => ({ id: c.id, label: c.label })),
  ];

  const category = analysisCategories.find((c) => c.id === active);

  return (
    <section className="analysis">
      <header className="an-head">
        <div>
          <h2>Inbox analysis</h2>
          <p className="an-sub">What each email actually told us</p>
        </div>
        <span className="an-count">
          <Layers size={11} /> {tabs.length} categories
        </span>
      </header>

      <div className="an-tabs" role="tablist" aria-label="Analysis categories">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            type="button"
            aria-selected={active === t.id}
            className={`an-tab ${active === t.id ? 'active' : ''}`}
            onClick={() => setActive(t.id)}
          >
            {t.label}
            {t.live && <span className="an-dot" title="Fed by the live inbox" />}
          </button>
        ))}
      </div>

      <div className="an-body" role="tabpanel">
        {active === 'statements' ? (
          <StatementsView view={view} />
        ) : category ? (
          <CategoryView category={category} />
        ) : null}
      </div>
    </section>
  );
};

export default AnalysisPanel;
