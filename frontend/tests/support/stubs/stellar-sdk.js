/**
 * @stellar/stellar-sdk stub for the a11y bundle.
 *
 * The builder imports StellarSdk for transaction construction, but the a11y
 * tests only audit DOM structure and accessibility — no Stellar transaction is
 * ever executed. This stub exposes the minimal surface the builder references
 * so the bundle resolves without pulling in the real SDK.
 */
export const Networks = {
  TESTNET: 'Test SDF Network ; September 2015',
  PUBLIC: 'Public Global Stellar Network ; September 2015',
};

export class Keypair {
  static fromPublicKey(pk) {
    if (!pk || typeof pk !== 'string' || !/^G[A-Z2-7]{55}$/.test(pk)) {
      throw new Error('Invalid public key');
    }
    return { publicKey: () => pk };
  }
}

export const BASE_FEE = '100';

export class Asset {
  constructor(code, issuer) { this._code = code; this._issuer = issuer; }
  static native() { return Object.assign(new Asset('XLM', undefined), { _type: 'native' }); }
  getCode() { return this._code; }
  getIssuer() { return this._issuer; }
  getAssetType() { return this._type || 'credit_alphanum4'; }
}

export class Memo {
  static text(v) { return { type: 'text', value: v }; }
}

export class TransactionBuilder {
  constructor(acct, opts) { this._account = acct; this._opts = opts; this._ops = []; }
  addOperation(op) { this._ops.push(op); return this; }
  addMemo(m) { this._memo = m; return this; }
  setTimeout(t) { this._timeout = t; return this; }
  build() { return { toXDR: () => 'STUB_XDR', _ops: this._ops, _memo: this._memo, _opts: this._opts }; }
  static fromXDR(xdr) { return { _xdr: xdr, toXDR: () => xdr }; }
}

export class Operation {
  static payment(args) { return { type: 'payment', ...args }; }
}

const stellarSdkStub = {
  Networks, Keypair, BASE_FEE, Asset, Memo, TransactionBuilder, Operation,
};
export default stellarSdkStub;
