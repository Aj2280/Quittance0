// Cryptographic signature verification for ownership-sensitive operations.
// Replaces string comparison with actual proof of private key control.
//
// Design: The client signs a message containing (operation, invoiceId, timestamp)
// with their Stellar private key. The server verifies the signature matches the
// claimed public key. The timestamp prevents replay attacks.
//
// Message format: `cancel:${invoiceId}:${timestamp}`
// Signature: ed25519 signature over the message hash
import { Keypair, StrKey } from '@stellar/stellar-sdk';
import crypto from 'crypto';

interface SignatureVerificationResult {
  valid: boolean;
  error?: string;
}

interface CancelSignaturePayload {
  invoiceId: string;
  sellerPublicKey: string;
  timestamp: number;
  signature: string;
}

const MAX_TIMESTAMP_SKEW_MS = 300000; // 5 minutes

/**
 * Verify a cancellation signature
 */
export function verifyCancelSignature(payload: CancelSignaturePayload): SignatureVerificationResult {
  try {
    const { invoiceId, sellerPublicKey, timestamp, signature } = payload;

    // Validate timestamp to prevent replay attacks
    const now = Date.now();
    const age = Math.abs(now - timestamp);
    
    if (age > MAX_TIMESTAMP_SKEW_MS) {
      return {
        valid: false,
        error: 'Signature timestamp is too old or too far in the future',
      };
    }

    // Validate public key format
    if (!StrKey.isValidEd25519PublicKey(sellerPublicKey)) {
      return {
        valid: false,
        error: 'Invalid Stellar public key format',
      };
    }

    // Construct the message that should have been signed
    const message = `cancel:${invoiceId}:${timestamp}`;
    const messageHash = crypto.createHash('sha256').update(message).digest();

    // Decode the signature and public key
    let signatureBuffer: Buffer;
    try {
      signatureBuffer = Buffer.from(signature, 'base64');
      if (signatureBuffer.length !== 64) {
        return {
          valid: false,
          error: 'Invalid signature length',
        };
      }
    } catch (error) {
      return {
        valid: false,
        error: 'Invalid signature encoding',
      };
    }

    // Verify the signature using Stellar SDK
    try {
      const keypair = Keypair.fromPublicKey(sellerPublicKey);
      const publicKeyBuffer = keypair.rawPublicKey();
      
      // Use Node's crypto for ed25519 verification
      const verified = crypto.verify(
        null, // ed25519 doesn't need a hash algorithm
        messageHash,
        {
          key: Buffer.concat([
            Buffer.from([0x30, 0x2a, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x03, 0x21, 0x00]),
            publicKeyBuffer,
          ]),
          format: 'der',
          type: 'spki',
        },
        signatureBuffer
      );

      if (!verified) {
        return {
          valid: false,
          error: 'Signature verification failed',
        };
      }

      return { valid: true };
    } catch (error: any) {
      return {
        valid: false,
        error: `Signature verification error: ${error.message}`,
      };
    }
  } catch (error: any) {
    return {
      valid: false,
      error: `Unexpected error: ${error.message}`,
    };
  }
}

/**
 * For backwards compatibility and controlled rollout: check if signature
 * verification should be enforced based on environment config.
 */
export function signatureVerificationRequired(): boolean {
  // Always require signatures in production
  if (process.env.NODE_ENV === 'production') {
    return true;
  }

  // In dev/test, allow opt-in via env var
  return process.env.REQUIRE_SIGNATURES === 'true';
}

/**
 * Extract signature payload from request body
 */
export function extractCancelSignature(body: any): CancelSignaturePayload | null {
  if (!body || typeof body !== 'object') {
    return null;
  }

  const { invoiceId, sellerPublicKey, timestamp, signature } = body;

  if (!invoiceId || !sellerPublicKey || !timestamp || !signature) {
    return null;
  }

  return {
    invoiceId,
    sellerPublicKey,
    timestamp: parseInt(timestamp, 10),
    signature,
  };
}

export default {
  verifyCancelSignature,
  signatureVerificationRequired,
  extractCancelSignature,
};
