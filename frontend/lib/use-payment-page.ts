'use client';

import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { apiErrorMessage, invoiceApi, isApiUnavailableError, PAYMENT_STATUS_POLL_INTERVAL_MS, resolveVerificationError } from './api';
import { checkTxHash } from './verification';
import {
  HORIZON_OUTAGE_MESSAGE,
  isHorizonOutageError,
} from './horizon-outage';
import {
  PAY_STATES,
  initialPaymentState,
  normalizePayerDetails,
  paymentReducer,
  shouldDropPendingPayment,
  shouldPoll,
} from './payment-page-state';
import type { PayPageInvoice, PayPagePaymentInfo } from '@/components/pay-page.types';
import { toast } from 'sonner';
import { useWalletStore } from './store';

export function usePaymentPage(id: string) {
  const [payment, dispatch] = useReducer(paymentReducer, undefined, () => initialPaymentState(null));
  const [loading, setLoading] = useState(true);
  const [paymentInfo, setPaymentInfo] = useState<PayPagePaymentInfo | null>(null);
  const { publicKey, connected, network } = useWalletStore();
  const [txHash, setTxHash] = useState('');
  const [payerName, setPayerName] = useState('');
  const [payerEmail, setPayerEmail] = useState('');
  const [loadError, setLoadError] = useState<string | null>(null);
  const generation = useRef(0);
  const walletSessionRef = useRef({ publicKey, network, connected });

  const load = useCallback(async () => {
    const request = generation.current;
    setLoadError(null);

    try {
      const [invoiceResult, infoResult] = await Promise.allSettled([
        invoiceApi.getById(id),
        invoiceApi.getPaymentInfo(id),
      ]);

      if (request !== generation.current) return;
      if (invoiceResult.status === 'rejected') throw invoiceResult.reason;

      dispatch({ type: 'INVOICE_LOADED', invoice: invoiceResult.value.data });
      if (infoResult.status === 'fulfilled') {
        setPaymentInfo(infoResult.value.data);
      } else {
        setLoadError(apiErrorMessage(infoResult.reason));
      }
    } catch (error) {
      if (request !== generation.current) return;
      const message = apiErrorMessage(error, 'Failed to load invoice');
      if (isApiUnavailableError(error)) setLoadError(message);
      toast.error(message);
    } finally {
      if (request === generation.current) setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    generation.current += 1;
    setLoading(true);
    setPaymentInfo(null);
    setTxHash('');
    dispatch({ type: 'INVOICE_LOADED', invoice: null });
    void load();
    return () => {
      generation.current += 1;
    };
  }, [id, load]);

  // A wallet switch or disconnect cancels the previous key's in-flight work
  // (issue #508): bump the generation so a load/verify/poll response in flight
  // is dropped, clear the pending hash, and reset the session UI. Terminal
  // states survive — a settled invoice stays settled for whoever is watching.
  useEffect(() => {
    const previous = walletSessionRef.current;
    const next = { publicKey, network, connected };
    walletSessionRef.current = next;
    if (!shouldDropPendingPayment(previous, next, payment.status)) return;
    generation.current += 1;
    setTxHash('');
    dispatch({ type: 'RESET' });
  }, [publicKey, network, connected, payment.status]);

  useEffect(() => {
    if (!shouldPoll(payment)) return;
    const request = generation.current;
    const interval = setInterval(async () => {
      try {
        const result = await invoiceApi.getById(id);
        if (request !== generation.current || result.data.status === 'PENDING') return;
        dispatch({ type: 'POLL_RESULT', invoice: result.data });
        if (result.data.status === 'PAID') toast.success('Payment confirmed!');
      } catch (error) {
        console.error('Invoice status polling failed:', error);
        if (isApiUnavailableError(error)) setLoadError(apiErrorMessage(error));
        else if (isHorizonOutageError(error)) setLoadError(HORIZON_OUTAGE_MESSAGE);
      }
    }, paymentInfo?.statusPollingIntervalMs ?? PAYMENT_STATUS_POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [id, payment, paymentInfo?.statusPollingIntervalMs]);

  const verify = async () => {
    const checked = checkTxHash(txHash);
    if (!checked.ok) return toast.error(checked.error);
    const payer = normalizePayerDetails({ payerName, payerEmail });
    if (!payer.ok) return toast.error(payer.error);
    dispatch({ type: 'VERIFY_STARTED' });
    const request = generation.current;
    const sessionKey = connected ? publicKey : null;
    try {
      const result = await invoiceApi.verify(id, checked.value, payer.value);
      if (request !== generation.current) return;
      // A mid-flight wallet switch must not let the previous key's verify
      // complete under the new session, even if the response arrives before
      // the session-change effect runs. A verify started while disconnected
      // carries no key, so a later connect does not invalidate it.
      const latest = useWalletStore.getState();
      const latestKey = latest.connected ? latest.publicKey : null;
      if (sessionKey !== null && latestKey !== sessionKey) return;
      dispatch({ type: 'VERIFY_SUCCEEDED', invoice: result?.data ?? null });
      toast.success('Transaction verified!');
      void load();
    } catch (error) {
      if (request !== generation.current) return;

      // Same guard as the success path: the error belongs to the session
      // that started the verify, not whichever wallet is connected now.
      const latest = useWalletStore.getState();
      const latestKey = latest.connected ? latest.publicKey : null;
      if (sessionKey !== null && latestKey !== sessionKey) return;

      // A Horizon or transport failure is not a rejection: keep the session,
      // say it is retryable, and leave the verify control in place.
      if (isHorizonOutageError(error)) {
        setLoadError(HORIZON_OUTAGE_MESSAGE);
        dispatch({ type: 'VERIFY_UNAVAILABLE' });
        toast.error(HORIZON_OUTAGE_MESSAGE);
        return;
      }

      const message = resolveVerificationError(error);
      if (isApiUnavailableError(error)) setLoadError(apiErrorMessage(error));
      dispatch({ type: 'VERIFY_FAILED', error: message });
      toast.error(message);
    }
  };

  return {
    invoice: payment.invoice as PayPageInvoice | null,
    payment,
    loading,
    loadError,
    paymentInfo,
    wallet: connected ? publicKey : null,
    txHash,
    setTxHash,
    payerName,
    setPayerName,
    payerEmail,
    setPayerEmail,
    verifying: payment.status === PAY_STATES.VERIFYING,
    monitoring: shouldPoll(payment),
    dispatch,
    verify,
    reload: load,
  };
}
