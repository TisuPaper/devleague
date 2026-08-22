import React, { useState } from 'react';
import { AlertTriangle, Clock, Info, Check, Sparkles } from 'lucide-react';
import './RemindersWidget.css';

// Icon + label per severity. State is carried by all three of colour, icon and
// text — never colour alone, which matters for colour-blind readers and for
// anyone skimming in a hurry.
const SEVERITY = {
  urgent: { icon: AlertTriangle, label: 'Act now', order: 0 },
  soon: { icon: Clock, label: 'Coming up', order: 1 },
  info: { icon: Info, label: 'Worth knowing', order: 2 },
};

// Three is about as many actions as anyone acts on in one sitting. The rest
// stay one click away rather than being dropped.
const VISIBLE = 3;

const RemindersWidget = ({ reminders }) => {
  const [done, setDone] = useState(() => new Set());
  const [showAll, setShowAll] = useState(false);

  const toggle = (id) => {
    setDone((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Urgent first, then coming up, then FYI. Within a severity the incoming
  // order is kept, which puts freshly-parsed items above the standing ones.
  const sorted = [...reminders].sort(
    (a, b) => (SEVERITY[a.severity]?.order ?? 9) - (SEVERITY[b.severity]?.order ?? 9)
  );

  const outstanding = sorted.filter((r) => !done.has(r.id));
  const urgentCount = outstanding.filter((r) => r.severity === 'urgent').length;

  const visible = showAll ? sorted : sorted.slice(0, VISIBLE);
  const hidden = sorted.length - visible.length;

  return (
    <section className="reminders">
      <header className="reminders-head">
        <div>
          <h2>What you should do now</h2>
          <p className="reminders-sub">
            {outstanding.length === 0
              ? 'Nothing outstanding — you are all caught up.'
              : `${outstanding.length} open${urgentCount ? ` · ${urgentCount} needs attention today` : ''}`}
          </p>
        </div>
      </header>

      <ul className="reminders-list">
        {visible.map((r) => {
          const meta = SEVERITY[r.severity] ?? SEVERITY.info;
          const Icon = meta.icon;
          const isDone = done.has(r.id);

          return (
            <li
              key={r.id}
              className={`reminder ${r.severity} ${isDone ? 'done' : ''}`}
            >
              <button
                type="button"
                className="reminder-check"
                onClick={() => toggle(r.id)}
                aria-pressed={isDone}
                aria-label={isDone ? `Mark "${r.title}" as not done` : `Mark "${r.title}" as done`}
              >
                {isDone ? <Check size={12} /> : <Icon size={13} />}
              </button>

              <div className="reminder-body">
                <div className="reminder-top">
                  <span className="reminder-title">{r.title}</span>
                  {r.live && (
                    <span className="reminder-live" title="Parsed from a real email">
                      <Sparkles size={10} /> new
                    </span>
                  )}
                </div>
                <p className="reminder-detail">{r.detail}</p>
              </div>

              <div className="reminder-meta">
                <span className="reminder-sev">{meta.label}</span>
                <span className="reminder-due">{r.due}</span>
              </div>
            </li>
          );
        })}
      </ul>

      {(hidden > 0 || showAll) && (
        <button
          type="button"
          className="reminders-more"
          onClick={() => setShowAll((v) => !v)}
        >
          {showAll ? 'Show top 3 only' : `Show ${hidden} more`}
        </button>
      )}
    </section>
  );
};

export default RemindersWidget;
