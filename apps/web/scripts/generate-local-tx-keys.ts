/**
 * Generate Ed25519 key pair for local transaction token signing (G2.7).
 *
 * Usage:
 *   npx tsx scripts/generate-local-tx-keys.ts
 *
 * Output the two env var values to copy into your .env.local file.
 */

import { generateKeyPairSync } from 'crypto';

const { privateKey, publicKey } = generateKeyPairSync('ed25519', {
  privateKeyEncoding: { type: 'pkcs8', format: 'der' },
  publicKeyEncoding: { type: 'spki', format: 'der' },
});

const privateKeyB64 = privateKey.toString('base64');
const publicKeyB64 = publicKey.toString('base64');

console.log('# Add these to your .env.local file:');
console.log('');
console.log(`LOCAL_TX_SIGNING_KEY=${privateKeyB64}`);
console.log(`NEXT_PUBLIC_LOCAL_TX_VERIFY_KEY=${publicKeyB64}`);
console.log('');
console.log('# IMPORTANT: LOCAL_TX_SIGNING_KEY is the private key — never expose it to the client.');
console.log('# NEXT_PUBLIC_LOCAL_TX_VERIFY_KEY is the public key — safe to embed in the client bundle.');
