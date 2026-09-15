'use client';

import { TimelineItem } from '@/lib/invoice-workspace';
import { formatDate, shortenAddress } from '@/lib/utils';
import { CheckCircle2, Clock, XCircle, AlertCircle, AlertTriangle, ExternalLink } from 'lucide-react';

interface InvoiceTimelineProps {
  items: TimelineItem[];
  className?: string;
}

export default function InvoiceTimeline({ items, className = '' }: InvoiceTimelineProps) {
  if (!items || items.length === 0) return null;

  return (
    <section className={`card ${className}`} aria-labelledby="timeline-heading">
      <h3 id="timeline-heading" className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
        <Clock className="w-5 h-5 text-teal-700" aria-hidden="true" />
        Invoice Timeline & Events
      </h3>

      <ol className="relative border-l border-gray-200 ml-3 space-y-6">
        {items.map((item, idx) => {
          const isCompleted = item.status === 'completed';
          const isActive = item.status === 'active';
          const isCancelled = item.status === 'cancelled';
          const isExpired = item.status === 'expired';
          const isWarning = item.status === 'warning';

          return (
            <li key={item.id || idx} className="ml-6">
              {/* Timeline dot icon */}
              <span
                className={`absolute -left-3.5 flex items-center justify-center w-7 h-7 rounded-full ring-4 ring-white ${
                  isCompleted
                    ? 'bg-emerald-600 text-white'
                    : isActive
                    ? 'bg-blue-600 text-white animate-pulse'
                    : isCancelled
                    ? 'bg-rose-600 text-white'
                    : isExpired
                    ? 'bg-amber-600 text-white'
                    : 'bg-yellow-500 text-white'
                }`}
                aria-hidden="true"
              >
                {isCompleted && <CheckCircle2 className="w-4 h-4" />}
                {isActive && <Clock className="w-4 h-4" />}
                {isCancelled && <XCircle className="w-4 h-4" />}
                {isExpired && <AlertCircle className="w-4 h-4" />}
                {isWarning && <AlertTriangle className="w-4 h-4" />}
              </span>

              <div className="bg-gray-50/80 p-4 rounded-xl border border-gray-200/70 shadow-sm">
                <div className="flex flex-wrap items-baseline justify-between gap-2 mb-1">
                  <h4 className="text-base font-semibold text-gray-900">{item.label}</h4>
                  {item.timestamp && (
                    <time
                      dateTime={typeof item.timestamp === 'string' ? item.timestamp : item.timestamp.toISOString()}
                      className="text-xs text-gray-500 font-mono"
                    >
                      {formatDate(item.timestamp)}
                    </time>
                  )}
                </div>

                {item.description && (
                  <p className="text-sm text-gray-600 mb-2">{item.description}</p>
                )}

                {item.txHash && (
                  <div className="mt-2 text-xs flex flex-wrap items-center gap-2 pt-2 border-t border-gray-200/60 font-mono">
                    <span className="text-gray-500">Tx:</span>
                    <span className="text-gray-800 break-all">{item.txHash.slice(0, 16)}...{item.txHash.slice(-8)}</span>
                    {item.explorerUrl && (
                      <a
                        href={item.explorerUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-teal-700 hover:text-teal-900 font-sans font-medium underline"
                        aria-label="View transaction on Stellar Expert explorer"
                      >
                        Explorer
                        <ExternalLink className="w-3 h-3" aria-hidden="true" />
                      </a>
                    )}
                  </div>
                )}

                {item.payerPublicKey && (
                  <div className="mt-1 text-xs text-gray-500 font-mono">
                    Payer: {shortenAddress(item.payerPublicKey)}
                  </div>
                )}

                {isWarning && (
                  <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 font-medium">
                    ⚠️ {item.description}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
