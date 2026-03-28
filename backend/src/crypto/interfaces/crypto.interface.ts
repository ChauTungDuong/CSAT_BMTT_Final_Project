// CellValue: cấu trúc lưu mỗi trường đã mã hoá trong Oracle BLOB
export interface ClearCell {
  type: 'clear';
  data: string;
}

export interface EncryptedCell {
  type: 'encrypted';
  algo: 'aes-256-gcm';
  payload: string; // base64 ciphertext
  iv: string; // base64 12-byte IV (ngẫu nhiên mỗi lần encrypt)
  tag: string; // base64 16-byte GCM auth tag
  hmac?: string; // Backward compatibility with legacy payloads
}

export type CellValue = ClearCell | EncryptedCell;

export interface ICryptoService {
  encrypt(plaintext: string): Promise<CellValue>;
  decrypt(cell: CellValue): Promise<string | null>;
  serialize(cell: CellValue): Buffer;
  deserialize(data: Buffer): CellValue;
}
