import { Injectable } from '@nestjs/common';
import { Role } from '../common/types/role.enum';

export type FieldType =
  | 'phone'
  | 'cccd'
  | 'account_number'
  | 'card_number'
  | 'cvv'
  | 'balance'
  | 'email'
  | 'address'
  | 'date_of_birth';

@Injectable()
export class MaskingEngine {
  /**
   * Mask một giá trị theo field type và viewer role.
   */
  mask(
    value: string,
    field: FieldType,
    role: Role,
    isPinVerified = false,
  ): string {
    if (!value) return this.fullMask(field);

    // Customer đã xác thực PIN → hiện toàn bộ
    if (role === Role.CUSTOMER && isPinVerified) {
      return value;
    }

    switch (role) {
      case Role.CUSTOMER:
        return this.maskForCustomer(value, field);
      case Role.TELLER:
        return this.maskForTeller(value, field);
      case Role.ADMIN:
        return this.maskForAdmin(value, field);
      default:
        return this.fullMask(field);
    }
  }

  // ── CUSTOMER (chưa xác thực PIN) ──────────────────────────────
  private maskForCustomer(value: string, field: FieldType): string {
    switch (field) {
      case 'phone':
        return value.replace(/^(\d{3})\d{4}(\d{3})$/, '$1****$2');
      case 'cccd':
        return value.replace(/^(\d{3})\d{5}(\d{4})$/, '$1*****$2');
      case 'account_number':
        return value.replace(/^\d+(\d{4})$/, '******$1');
      case 'card_number':
        return value.replace(/^(\d{4})\d{8}(\d{4})$/, '**** **** **** $2');
      case 'cvv':
        return '***';
      case 'balance':
        return '••••••';
      case 'email':
        return value.replace(/^(\w{2})\w+(@.+)$/, '$1***$2');
      case 'date_of_birth':
        return value.replace(/^(\d{2})\/(\d{2})\/(\d{4})$/, '**/**/$3');
      case 'address':
        return value.split(',').slice(-2).join(',').trim();
      default:
        return value;
    }
  }

  // ── TELLER (nhân viên giao dịch) ─────────────────────────────
  private maskForTeller(value: string, field: FieldType): string {
    switch (field) {
      case 'phone':
        return value.replace(/^(\d{3})\d{4}(\d{3})$/, '$1****$2');
      case 'email':
        return value.replace(/^(\w{2,3})\w+(@.+)$/, '$1***$2');
      case 'cccd':
        return this.fullMask('cccd');
      case 'card_number':
        return this.fullMask('card_number');
      case 'cvv':
        return '***';
      case 'balance':
        return this.balanceRange(value);
      case 'account_number':
        return value.replace(/^\d+(\d{4})$/, '******$1');
      case 'date_of_birth':
        return value.replace(/^(\d{2})\/(\d{2})\/(\d{4})$/, '**/**/$3');
      case 'address':
        return value.split(',').slice(-2).join(',').trim();
      default:
        return value;
    }
  }

  // ── ADMIN (quản trị hệ thống) ─────────────────────────────────
  private maskForAdmin(value: string, field: FieldType): string {
    switch (field) {
      case 'phone':
        return value.replace(/^(\d{3})\d{4}(\d{3})$/, '$1****$2');
      case 'email':
        return value.replace(/^(\w{2,3})\w+(@.+)$/, '$1***$2');
      case 'cccd':
        return this.fullMask('cccd');
      case 'card_number':
        return this.fullMask('card_number');
      case 'cvv':
        return '***';
      case 'balance':
        return this.fullMask('balance');
      case 'account_number':
        return value.replace(/^\d+(\d{4})$/, '******$1');
      case 'date_of_birth':
        return value.replace(/^(\d{2})\/(\d{2})\/(\d{4})$/, '**/**/$3');
      case 'address':
        return (
          value.split(',').slice(-1)[0]?.trim() || this.fullMask('address')
        );
      default:
        return value;
    }
  }

  private balanceRange(value: string): string {
    const num = parseFloat(value.replace(/[^0-9.]/g, ''));
    if (isNaN(num)) return '*** đ';
    if (num < 1_000_000) return '< 1 triệu đ';
    if (num < 10_000_000) return '1-10 triệu đ';
    if (num < 100_000_000) return '10-100 triệu đ';
    return '> 100 triệu đ';
  }

  private fullMask(field: FieldType): string {
    const masks: Record<FieldType, string> = {
      phone: '**********',
      cccd: '************',
      account_number: '**********',
      card_number: '**** **** **** ****',
      cvv: '***',
      balance: '••••••',
      email: '***@***.***',
      address: '***',
      date_of_birth: '**/**/****',
    };
    return masks[field] || '***';
  }
}
