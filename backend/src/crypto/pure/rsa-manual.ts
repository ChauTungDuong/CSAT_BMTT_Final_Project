const SHA256_K = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1,
  0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
  0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
  0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
  0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
  0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
  0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
];

const SHA256_INIT = [
  0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c,
  0x1f83d9ab, 0x5be0cd19,
];

export interface RsaPublicKeyMaterial {
  n: bigint;
  e: bigint;
  nHex: string;
  eHex: string;
}

export interface RsaPrivateKeyMaterial extends RsaPublicKeyMaterial {
  d: bigint;
  dHex: string;
}

type Asn1Element = {
  tag: number;
  offset: number;
  headerLength: number;
  length: number;
  valueStart: number;
  valueEnd: number;
  totalLength: number;
};

export function sha256(input: Uint8Array): Uint8Array {
  const padded = padSha256(input);
  const h = SHA256_INIT.slice();
  const w = new Array<number>(64);

  for (let chunkStart = 0; chunkStart < padded.length; chunkStart += 64) {
    for (let i = 0; i < 16; i += 1) {
      const j = chunkStart + i * 4;
      w[i] =
        ((padded[j] << 24) |
          (padded[j + 1] << 16) |
          (padded[j + 2] << 8) |
          padded[j + 3]) >>>
        0;
    }

    for (let i = 16; i < 64; i += 1) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }

    let a = h[0];
    let b = h[1];
    let c = h[2];
    let d = h[3];
    let e = h[4];
    let f = h[5];
    let g = h[6];
    let hh = h[7];

    for (let i = 0; i < 64; i += 1) {
      const s1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (hh + s1 + ch + SHA256_K[i] + w[i]) >>> 0;
      const s0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (s0 + maj) >>> 0;

      hh = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    h[0] = (h[0] + a) >>> 0;
    h[1] = (h[1] + b) >>> 0;
    h[2] = (h[2] + c) >>> 0;
    h[3] = (h[3] + d) >>> 0;
    h[4] = (h[4] + e) >>> 0;
    h[5] = (h[5] + f) >>> 0;
    h[6] = (h[6] + g) >>> 0;
    h[7] = (h[7] + hh) >>> 0;
  }

  const out = new Uint8Array(32);
  for (let i = 0; i < 8; i += 1) {
    out[i * 4] = (h[i] >>> 24) & 0xff;
    out[i * 4 + 1] = (h[i] >>> 16) & 0xff;
    out[i * 4 + 2] = (h[i] >>> 8) & 0xff;
    out[i * 4 + 3] = h[i] & 0xff;
  }
  return out;
}

export function mgf1(seed: Uint8Array, outputLength: number): Uint8Array {
  const out = new Uint8Array(outputLength);
  let counter = 0;
  let written = 0;

  while (written < outputLength) {
    const c = i2osp(counter, 4);
    const hash = sha256(concat(seed, c));
    const take = Math.min(hash.length, outputLength - written);
    out.set(hash.slice(0, take), written);
    written += take;
    counter += 1;
  }

  return out;
}

export function rsaOaepEncrypt(
  message: Uint8Array,
  key: RsaPublicKeyMaterial,
  randomBytes: (size: number) => Uint8Array,
): Uint8Array {
  const k = byteLengthFromModulus(key.n);
  const hLen = 32;

  if (message.length > k - 2 * hLen - 2) {
    throw new Error('Message quá dài cho RSA-OAEP');
  }

  const lHash = sha256(new Uint8Array(0));
  const ps = new Uint8Array(k - message.length - 2 * hLen - 2);
  const db = concat(concat(lHash, ps), concat(new Uint8Array([0x01]), message));

  const seed = randomBytes(hLen);
  const dbMask = mgf1(seed, k - hLen - 1);
  const maskedDb = xor(db, dbMask);
  const seedMask = mgf1(maskedDb, hLen);
  const maskedSeed = xor(seed, seedMask);

  const em = concat(new Uint8Array([0x00]), concat(maskedSeed, maskedDb));
  const m = os2ip(em);
  const c = modPow(m, key.e, key.n);
  return i2osp(c, k);
}

export function rsaOaepDecrypt(
  ciphertext: Uint8Array,
  key: RsaPrivateKeyMaterial,
): Uint8Array {
  const k = byteLengthFromModulus(key.n);
  const hLen = 32;

  if (ciphertext.length !== k) {
    throw new Error('Ciphertext có kích thước không hợp lệ');
  }

  const c = os2ip(ciphertext);
  const m = modPow(c, key.d, key.n);
  const em = i2osp(m, k);

  if (em[0] !== 0x00) {
    throw new Error('EM prefix không hợp lệ');
  }

  const maskedSeed = em.slice(1, 1 + hLen);
  const maskedDb = em.slice(1 + hLen);

  const seedMask = mgf1(maskedDb, hLen);
  const seed = xor(maskedSeed, seedMask);
  const dbMask = mgf1(seed, k - hLen - 1);
  const db = xor(maskedDb, dbMask);

  const lHash = sha256(new Uint8Array(0));
  const dbLHash = db.slice(0, hLen);
  if (!equalBytes(dbLHash, lHash)) {
    throw new Error('OAEP lHash không hợp lệ');
  }

  let sepIndex = -1;
  for (let i = hLen; i < db.length; i += 1) {
    if (db[i] === 0x01) {
      sepIndex = i;
      break;
    }
    if (db[i] !== 0x00) {
      throw new Error('OAEP padding không hợp lệ');
    }
  }

  if (sepIndex === -1) {
    throw new Error('Không tìm thấy marker OAEP');
  }

  return db.slice(sepIndex + 1);
}

export function computeKeyId(publicKey: RsaPublicKeyMaterial): string {
  const source = utf8(`${publicKey.nHex}:${publicKey.eHex}`);
  return toHex(sha256(source)).slice(0, 16);
}

export function parseRsaPublicKeyFromPem(pem: string): RsaPublicKeyMaterial {
  const der = pemToDer(pem);

  if (pem.includes('BEGIN RSA PUBLIC KEY')) {
    return parseRsaPublicKeyPkcs1Der(der);
  }

  const root = readElement(der, 0);
  assertTag(root, 0x30, 'public root sequence');

  let childOffset = root.valueStart;
  const first = readElement(der, childOffset);
  assertTag(first, 0x30, 'public algorithm sequence');
  childOffset += first.totalLength;

  const bitString = readElement(der, childOffset);
  assertTag(bitString, 0x03, 'public bitstring');

  const bitValue = der.slice(bitString.valueStart, bitString.valueEnd);
  if (bitValue.length < 2 || bitValue[0] !== 0x00) {
    throw new Error('Public key bitstring không hợp lệ');
  }

  const rsaDer = bitValue.slice(1);
  return parseRsaPublicKeyPkcs1Der(rsaDer);
}

export function parseRsaPrivateKeyFromPem(pem: string): RsaPrivateKeyMaterial {
  const der = pemToDer(pem);

  if (pem.includes('BEGIN RSA PRIVATE KEY')) {
    return parseRsaPrivateKeyPkcs1Der(der);
  }

  const root = readElement(der, 0);
  assertTag(root, 0x30, 'private root sequence');

  let childOffset = root.valueStart;
  const version = readElement(der, childOffset);
  assertTag(version, 0x02, 'pkcs8 version');
  childOffset += version.totalLength;

  const algorithm = readElement(der, childOffset);
  assertTag(algorithm, 0x30, 'pkcs8 algorithm');
  childOffset += algorithm.totalLength;

  const privateOctet = readElement(der, childOffset);
  assertTag(privateOctet, 0x04, 'pkcs8 private key octet');

  const privateDer = der.slice(privateOctet.valueStart, privateOctet.valueEnd);
  return parseRsaPrivateKeyPkcs1Der(privateDer);
}

export function parseRsaPublicKeyPkcs1Der(
  der: Uint8Array,
): RsaPublicKeyMaterial {
  const root = readElement(der, 0);
  assertTag(root, 0x30, 'pkcs1 public sequence');

  let offset = root.valueStart;
  const nElem = readElement(der, offset);
  assertTag(nElem, 0x02, 'modulus integer');
  offset += nElem.totalLength;
  const eElem = readElement(der, offset);
  assertTag(eElem, 0x02, 'public exponent integer');

  const nBytes = trimLeadingZero(der.slice(nElem.valueStart, nElem.valueEnd));
  const eBytes = trimLeadingZero(der.slice(eElem.valueStart, eElem.valueEnd));

  const nHex = toHex(nBytes);
  const eHex = toHex(eBytes);

  return {
    n: hexToBigInt(nHex),
    e: hexToBigInt(eHex),
    nHex,
    eHex,
  };
}

export function parseRsaPrivateKeyPkcs1Der(
  der: Uint8Array,
): RsaPrivateKeyMaterial {
  const root = readElement(der, 0);
  assertTag(root, 0x30, 'pkcs1 private sequence');

  let offset = root.valueStart;
  const version = readElement(der, offset);
  assertTag(version, 0x02, 'pkcs1 version');
  offset += version.totalLength;

  const nElem = readElement(der, offset);
  assertTag(nElem, 0x02, 'modulus integer');
  offset += nElem.totalLength;

  const eElem = readElement(der, offset);
  assertTag(eElem, 0x02, 'public exponent integer');
  offset += eElem.totalLength;

  const dElem = readElement(der, offset);
  assertTag(dElem, 0x02, 'private exponent integer');

  const nHex = toHex(
    trimLeadingZero(der.slice(nElem.valueStart, nElem.valueEnd)),
  );
  const eHex = toHex(
    trimLeadingZero(der.slice(eElem.valueStart, eElem.valueEnd)),
  );
  const dHex = toHex(
    trimLeadingZero(der.slice(dElem.valueStart, dElem.valueEnd)),
  );

  return {
    n: hexToBigInt(nHex),
    e: hexToBigInt(eHex),
    d: hexToBigInt(dHex),
    nHex,
    eHex,
    dHex,
  };
}

export function pemToDer(pem: string): Uint8Array {
  const body = pem
    .replace(/-----BEGIN [^-]+-----/g, '')
    .replace(/-----END [^-]+-----/g, '')
    .replace(/\s+/g, '');

  return base64ToBytes(body);
}

export function base64ToBytes(base64: string): Uint8Array {
  const binary = Buffer.from(base64, 'base64');
  return new Uint8Array(binary);
}

export function bytesToBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64');
}

export function toHex(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 1) {
    out += bytes[i].toString(16).padStart(2, '0');
  }
  return out;
}

export function hexToBigInt(hex: string): bigint {
  const normalized = hex.trim().replace(/^0x/i, '');
  if (!normalized) {
    return 0n;
  }
  return BigInt(`0x${normalized}`);
}

function readElement(bytes: Uint8Array, offset: number): Asn1Element {
  if (offset >= bytes.length) {
    throw new Error('ASN.1 offset vượt giới hạn');
  }

  const tag = bytes[offset];
  const lenFirst = bytes[offset + 1];
  if (lenFirst === undefined) {
    throw new Error('ASN.1 thiếu length');
  }

  let length = 0;
  let lengthBytes = 0;
  if ((lenFirst & 0x80) === 0) {
    length = lenFirst;
  } else {
    const count = lenFirst & 0x7f;
    if (count === 0 || count > 4) {
      throw new Error('ASN.1 length dạng indefinite hoặc quá dài');
    }
    lengthBytes = count;
    for (let i = 0; i < count; i += 1) {
      const b = bytes[offset + 2 + i];
      if (b === undefined) {
        throw new Error('ASN.1 length truncated');
      }
      length = (length << 8) | b;
    }
  }

  const headerLength = 2 + lengthBytes;
  const valueStart = offset + headerLength;
  const valueEnd = valueStart + length;
  if (valueEnd > bytes.length) {
    throw new Error('ASN.1 value vượt giới hạn');
  }

  return {
    tag,
    offset,
    headerLength,
    length,
    valueStart,
    valueEnd,
    totalLength: headerLength + length,
  };
}

function assertTag(
  element: Asn1Element,
  expectedTag: number,
  label: string,
): void {
  if (element.tag !== expectedTag) {
    throw new Error(`ASN.1 tag không hợp lệ cho ${label}`);
  }
}

function trimLeadingZero(bytes: Uint8Array): Uint8Array {
  if (bytes.length > 1 && bytes[0] === 0x00) {
    return bytes.slice(1);
  }
  return bytes;
}

function rotr(value: number, bits: number): number {
  return ((value >>> bits) | (value << (32 - bits))) >>> 0;
}

function padSha256(input: Uint8Array): Uint8Array {
  const bitLen = input.length * 8;
  const withOne = input.length + 1;
  const mod = withOne % 64;
  const zeroPad = mod <= 56 ? 56 - mod : 120 - mod;
  const totalLen = withOne + zeroPad + 8;

  const out = new Uint8Array(totalLen);
  out.set(input, 0);
  out[input.length] = 0x80;

  const view = new DataView(out.buffer);
  view.setUint32(totalLen - 8, Math.floor(bitLen / 0x100000000), false);
  view.setUint32(totalLen - 4, bitLen >>> 0, false);
  return out;
}

function concat(left: Uint8Array, right: Uint8Array): Uint8Array {
  const out = new Uint8Array(left.length + right.length);
  out.set(left, 0);
  out.set(right, left.length);
  return out;
}

function xor(left: Uint8Array, right: Uint8Array): Uint8Array {
  if (left.length !== right.length) {
    throw new Error('XOR length mismatch');
  }
  const out = new Uint8Array(left.length);
  for (let i = 0; i < left.length; i += 1) {
    out[i] = left[i] ^ right[i];
  }
  return out;
}

function equalBytes(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) {
    return false;
  }
  let diff = 0;
  for (let i = 0; i < left.length; i += 1) {
    diff |= left[i] ^ right[i];
  }
  return diff === 0;
}

function os2ip(bytes: Uint8Array): bigint {
  if (bytes.length === 0) {
    return 0n;
  }
  return BigInt(`0x${toHex(bytes)}`);
}

function i2osp(value: bigint | number, length: number): Uint8Array {
  const bn = typeof value === 'number' ? BigInt(value) : value;
  if (bn < 0n) {
    throw new Error('i2osp không hỗ trợ số âm');
  }

  let hex = bn.toString(16);
  if (hex.length % 2 !== 0) {
    hex = `0${hex}`;
  }

  const out = hex === '' ? new Uint8Array(0) : hexStringToBytes(hex);
  if (out.length > length) {
    throw new Error('i2osp overflow');
  }

  const padded = new Uint8Array(length);
  padded.set(out, length - out.length);
  return padded;
}

function hexStringToBytes(hex: string): Uint8Array {
  const normalized = hex.trim();
  const out = new Uint8Array(normalized.length / 2);
  for (let i = 0; i < out.length; i += 1) {
    out[i] = Number.parseInt(normalized.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function modPow(base: bigint, exponent: bigint, modulus: bigint): bigint {
  if (modulus === 1n) {
    return 0n;
  }

  let result = 1n;
  let b = ((base % modulus) + modulus) % modulus;
  let e = exponent;

  while (e > 0n) {
    if ((e & 1n) === 1n) {
      result = (result * b) % modulus;
    }
    e >>= 1n;
    b = (b * b) % modulus;
  }

  return result;
}

function bitLength(value: bigint): number {
  if (value === 0n) {
    return 0;
  }
  return value.toString(2).length;
}

function byteLengthFromModulus(n: bigint): number {
  return Math.ceil(bitLength(n) / 8);
}

function utf8(input: string): Uint8Array {
  return new TextEncoder().encode(input);
}
