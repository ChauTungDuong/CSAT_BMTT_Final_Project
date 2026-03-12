export enum Role {
  CUSTOMER = 'customer',
  TELLER = 'teller',
  ADMIN = 'admin',
}

export type ViewerRole = Role | 'self'; // 'self' = chính chủ đã xác thực PIN
