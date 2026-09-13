import { Keypair } from '@stellar/stellar-sdk';

/**
 * Verifies that a cryptographic ed25519 signature was produced by the holder
 * of the given Stellar public key over one of the candidate messages.
 *
 * Supports signatures in Base64 or Hex encoding.
 *
 * @param publicKey Valid 56-character Stellar public key (G...)
 * @param signature Hex or Base64 encoded signature string
 * @param candidateMessages Array of acceptable raw message strings to verify against
 * @returns boolean indicating whether the signature is cryptographically valid
 */
export function verifySellerSignature(
  publicKey: string,
  signature: string,
  candidateMessages: string[]
): boolean {
  if (!publicKey || !signature || !Array.isArray(candidateMessages) || candidateMessages.length === 0) {
    return false;
  }

  let keypair: Keypair;
  try {
    keypair = Keypair.fromPublicKey(publicKey);
  } catch {
    return false;
  }

  let signatureBuffer: Buffer;
  try {
    const trimmed = signature.trim();
    if (/^[0-9a-fA-F]{128}$/.test(trimmed)) {
      signatureBuffer = Buffer.from(trimmed, 'hex');
    } else {
      signatureBuffer = Buffer.from(trimmed, 'base64');
    }
    if (signatureBuffer.length !== 64) {
      return false;
    }
  } catch {
    return false;
  }

  for (const message of candidateMessages) {
    try {
      const data = Buffer.from(message, 'utf8');
      if (keypair.verify(data, signatureBuffer)) {
        return true;
      }
    } catch {
      continue;
    }
  }

  return false;
}
