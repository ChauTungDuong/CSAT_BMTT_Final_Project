export enum Role {
  CUSTOMER = 'customer',
  ADMIN = 'admin',
}

export type ViewerRole = Role | 'self'; // 'self' = chính chủ đã xác thực PIN
