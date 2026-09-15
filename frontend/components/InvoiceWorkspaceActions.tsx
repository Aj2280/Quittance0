'use client';

import { useState } from 'react';
import { WorkspaceActionVisibility } from '@/lib/invoice-workspace';
import { copyToClipboard } from '@/lib/utils';
import { invoiceSharePath } from '@/lib/invoice-share-path';
import { openInvoicePDF, shareInvoiceByEmail, emailPaymentProof } from '@/lib/export';
import { buildHorizonTxUrl } from '@/lib/explorer-tx-link';
import { Copy, Share2, Mail, Download, X, ExternalLink, Check } from 'lucide-react';
import { toast } from 'sonner';

interface InvoiceWorkspaceActionsProps {
  invoice: any;
  actions: WorkspaceActionVisibility;
  network?: string;
  onCancel: () => Promise<void>;
  cancelling?: boolean;
  className?: string;
}

export default function InvoiceWorkspaceActions({
  invoice,
  actions,
  network = 'testnet',
  onCancel,
  cancelling = false,
  className = '',
}: InvoiceWorkspaceActionsProps) {
  const [copied, setCopied] = useState(false);

  if (!invoice) return null;

  const payUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}${invoiceSharePath(invoice.id)}`
      : `/pay/${invoice.id}`;

  const handleCopyLink = async () => {
    const success = await copyToClipboard(payUrl);
    if (success) {
      setCopied(true);
      toast.success('Pay link copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } else {
      toast.error('Failed to copy link');
    }
  };

  const handleShare = async () => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: 'Quittance Invoice',
          text: `Pay ${invoice.amount} ${invoice.assetCode || 'XLM'}`,
          url: payUrl,
        });
      } catch {
        // Share cancelled or not supported
      }
    } else {
      await handleCopyLink();
    }
  };

  const handleEmailInvoice = () => {
    try {
      shareInvoiceByEmail(invoice);
      toast.success('Opening email client');
    } catch (err: any) {
      toast.error(err?.message || 'Could not open email client');
    }
  };

  const handleDownloadProof = () => {
    try {
      openInvoicePDF(invoice);
      toast.success('Opening payment proof PDF');
    } catch (err: any) {
      toast.error(err?.message || 'Could not generate payment proof');
    }
  };

  const handleEmailProof = () => {
    try {
      emailPaymentProof(invoice);
      toast.success('Opening email client for proof');
    } catch (err: any) {
      toast.error(err?.message || 'Could not send proof email');
    }
  };

  const explorerUrl = invoice.paymentTxHash
    ? buildHorizonTxUrl(invoice.paymentTxHash, network)
    : null;

  return (
    <div className={`flex flex-wrap items-center gap-2.5 ${className}`} role="toolbar" aria-label="Invoice seller actions">
      {/* 1. Share / Copy Link (always available for customer communication) */}
      <button
        onClick={handleShare}
        className="btn btn-outline flex items-center gap-2 text-sm min-h-[40px] px-3.5"
        aria-label="Share or copy payment link"
      >
        {copied ? (
          <Check className="w-4 h-4 text-emerald-600" aria-hidden="true" />
        ) : (
          <Share2 className="w-4 h-4" aria-hidden="true" />
        )}
        <span>{copied ? 'Link Copied' : 'Share / Copy'}</span>
      </button>

      {/* 2. Email Invoice to Customer (when pending and customer email exists) */}
      {actions.canEmailInvoice && (
        <button
          onClick={handleEmailInvoice}
          className="btn btn-outline flex items-center gap-2 text-sm min-h-[40px] px-3.5"
          aria-label={`Email invoice to ${invoice.customerEmail}`}
        >
          <Mail className="w-4 h-4" aria-hidden="true" />
          <span>Email Invoice</span>
        </button>
      )}

      {/* 3. Cancel Invoice (PENDING only, strictly never when PAID) */}
      {actions.canCancel && (
        <button
          onClick={onCancel}
          disabled={cancelling}
          className="btn btn-destructive flex items-center gap-2 text-sm min-h-[40px] px-3.5"
          aria-label="Cancel this pending invoice"
        >
          <X className="w-4 h-4" aria-hidden="true" />
          <span>{cancelling ? 'Cancelling...' : 'Cancel Invoice'}</span>
        </button>
      )}

      {/* 4. Download Proof PDF (PAID only) */}
      {actions.canDownloadProof && (
        <button
          onClick={handleDownloadProof}
          className="btn btn-primary flex items-center gap-2 text-sm min-h-[40px] px-3.5"
          aria-label="Download official payment proof PDF"
        >
          <Download className="w-4 h-4" aria-hidden="true" />
          <span>Payment Proof</span>
        </button>
      )}

      {/* 5. Email Proof (PAID only) */}
      {actions.canEmailProof && (
        <button
          onClick={handleEmailProof}
          className="btn btn-outline flex items-center gap-2 text-sm min-h-[40px] px-3.5"
          aria-label="Email payment proof"
        >
          <Mail className="w-4 h-4" aria-hidden="true" />
          <span>Email Proof</span>
        </button>
      )}

      {/* 6. Stellar Explorer Link (Settled only) */}
      {actions.canViewExplorer && explorerUrl && (
        <a
          href={explorerUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-outline flex items-center gap-2 text-sm min-h-[40px] px-3.5 text-teal-800 hover:text-teal-950"
          aria-label="View transaction details on Stellar Expert"
        >
          <ExternalLink className="w-4 h-4" aria-hidden="true" />
          <span>Stellar Explorer</span>
        </a>
      )}
    </div>
  );
}
