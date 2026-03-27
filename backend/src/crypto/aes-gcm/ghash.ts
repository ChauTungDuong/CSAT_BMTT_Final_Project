// GF(2^128) Multiplication and GHASH

/**
 * Multiplies two 16-byte blocks in the Galois field GF(2^128)
 * using the reducing polynomial x^128 + x^7 + x^2 + x + 1.
 * Elements are represented Little-Endian bitwise within bytes, but
 * globally blocks are Big-Endian. This is often called "GCM field".
 */
export function gf128Multiply(x: Uint8Array, y: Uint8Array): Uint8Array {
  // Convert inputs to 4x 32-bit big-endian words for efficient shifting
  const v = new Uint32Array(4);
  v[0] = (y[0] << 24) | (y[1] << 16) | (y[2] << 8) | y[3];
  v[1] = (y[4] << 24) | (y[5] << 16) | (y[6] << 8) | y[7];
  v[2] = (y[8] << 24) | (y[9] << 16) | (y[10] << 8) | y[11];
  v[3] = (y[12] << 24) | (y[13] << 16) | (y[14] << 8) | y[15];

  const z = new Uint32Array(4); // Accumulated result

  for (let i = 0; i < 16; i++) {
    for (let j = 7; j >= 0; j--) {
      // If the current bit of X is 1, add V to Z
      if ((x[i] & (1 << j)) !== 0) {
        z[0] ^= v[0]; z[1] ^= v[1]; z[2] ^= v[2]; z[3] ^= v[3];
      }
      
      // Shift V right by 1 bit.
      // If the lowest bit of V was 1 before shifting, we XOR with the R polynomial (0xE1000000...)
      const lsb = v[3] & 1;
      
      v[3] = (v[3] >>> 1) | ((v[2] & 1) << 31);
      v[2] = (v[2] >>> 1) | ((v[1] & 1) << 31);
      v[1] = (v[1] >>> 1) | ((v[0] & 1) << 31);
      v[0] = (v[0] >>> 1);

      if (lsb !== 0) {
        v[0] ^= 0xe1000000;
      }
    }
  }

  // Convert back to Uint8Array
  const result = new Uint8Array(16);
  result[0] = (z[0] >>> 24) & 0xff; result[1] = (z[0] >>> 16) & 0xff;
  result[2] = (z[0] >>> 8) & 0xff; result[3] = z[0] & 0xff;
  result[4] = (z[1] >>> 24) & 0xff; result[5] = (z[1] >>> 16) & 0xff;
  result[6] = (z[1] >>> 8) & 0xff; result[7] = z[1] & 0xff;
  result[8] = (z[2] >>> 24) & 0xff; result[9] = (z[2] >>> 16) & 0xff;
  result[10] = (z[2] >>> 8) & 0xff; result[11] = z[2] & 0xff;
  result[12] = (z[3] >>> 24) & 0xff; result[13] = (z[3] >>> 16) & 0xff;
  result[14] = (z[3] >>> 8) & 0xff; result[15] = z[3] & 0xff;
  return result;
}

/**
 * Computes the GHASH of AAD and Ciphertext using the Auth Key H
 * @param h The 16-byte authentication key (E(K, 0^128))
 * @param aad Additional authenticated data (Uint8Array)
 * @param ciphertext The encrypted payload (Uint8Array)
 */
export function ghash(h: Uint8Array, aad: Uint8Array, ciphertext: Uint8Array): Uint8Array {
  let y = new Uint8Array(16); // Accumulator starts at 0

  // Process AAD blocks (padded to 16 bytes)
  let offset = 0;
  while (offset < aad.length) {
    const block = new Uint8Array(16);
    const len = Math.min(16, aad.length - offset);
    for (let i = 0; i < len; i++) {
        block[i] = aad[offset + i];
    }
    // Y = (Y ^ block) * H
    for (let i = 0; i < 16; i++) y[i] ^= block[i];
    y = gf128Multiply(y, h) as any;
    offset += 16;
  }

  // Process Ciphertext blocks (padded to 16 bytes)
  offset = 0;
  while (offset < ciphertext.length) {
    const block = new Uint8Array(16);
    const len = Math.min(16, ciphertext.length - offset);
    for (let i = 0; i < len; i++) {
        block[i] = ciphertext[offset + i];
    }
    // Y = (Y ^ block) * H
    for (let i = 0; i < 16; i++) y[i] ^= block[i];
    y = gf128Multiply(y, h) as any;
    offset += 16;
  }

  // Final length block (64-bit len(AAD) || 64-bit len(Ciphertext) in BITS)
  // We'll write to a 16-byte array in Big Endian
  const lenBlock = new Uint8Array(16);
  
  // Note: JS numbers get imprecise above 2^53, so we handle standard lengths safely.
  // Size is in bits (* 8)
  const aadBits = aad.length * 8;
  const cphBits = ciphertext.length * 8;

  // AAD High 32 bits, Low 32 bits
  const aadHi = Math.floor(aadBits / 0x100000000); // Rare, usually 0
  const aadLo = aadBits & 0xffffffff;
  lenBlock[0] = (aadHi >>> 24) & 0xff; lenBlock[1] = (aadHi >>> 16) & 0xff;
  lenBlock[2] = (aadHi >>> 8) & 0xff; lenBlock[3] = aadHi & 0xff;
  lenBlock[4] = (aadLo >>> 24) & 0xff; lenBlock[5] = (aadLo >>> 16) & 0xff;
  lenBlock[6] = (aadLo >>> 8) & 0xff; lenBlock[7] = aadLo & 0xff;

  // Ciphertext High 32 bits, Low 32 bits
  const cphHi = Math.floor(cphBits / 0x100000000);
  const cphLo = cphBits & 0xffffffff;
  lenBlock[8] = (cphHi >>> 24) & 0xff; lenBlock[9] = (cphHi >>> 16) & 0xff;
  lenBlock[10] = (cphHi >>> 8) & 0xff; lenBlock[11] = cphHi & 0xff;
  lenBlock[12] = (cphLo >>> 24) & 0xff; lenBlock[13] = (cphLo >>> 16) & 0xff;
  lenBlock[14] = (cphLo >>> 8) & 0xff; lenBlock[15] = cphLo & 0xff;

  for (let i = 0; i < 16; i++) y[i] ^= lenBlock[i];
  y = gf128Multiply(y, h) as any;

  return y;
}
