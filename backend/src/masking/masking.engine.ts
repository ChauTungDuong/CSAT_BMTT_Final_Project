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
        return this.maskCenterChars(value, 2);
      case 'cccd':
        return this.maskCenterChars(value, 2);
      case 'account_number':
        // Số tài khoản luôn là field riêng, không che cho owner
        return value;
      case 'card_number':
        return value.replace(/^(\d{4})\d{8}(\d{4})$/, '**** **** **** $2');
      case 'cvv':
        return '***';
      case 'balance':
        return '••••••';
      case 'email':
        return this.maskEmailKeepLastOneBeforeAt(value);
      case 'date_of_birth':
        return value;
      case 'address':
        return value;
      default:
        return value;
    }
  }

  // ── ADMIN (quản trị hệ thống) ─────────────────────────────────
  private maskForAdmin(value: string, field: FieldType): string {
    switch (field) {
      case 'phone':
        return this.maskKeepHeadTail(value, 3, 3);
      case 'email':
        return this.maskEmailKeepFirstN(value, 4);
      case 'cccd':
        return this.fullMask('cccd');
      case 'card_number':
        return this.fullMask('card_number');
      case 'cvv':
        return '***';
      case 'balance':
        return this.fullMask('balance');
      case 'account_number':
        return this.maskKeepHeadTail(value, 3, 4);
      case 'date_of_birth':
        return this.maskDateOfBirth(value);
      case 'address':
        return (
          value.split(',').slice(-1)[0]?.trim() || this.fullMask('address')
        );
      default:
        return value;
    }
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

  private maskDateOfBirth(value: string): string {
    const normalized = value.trim();

    // dd/MM/yyyy
    const slash = normalized.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (slash) {
      return `**/**/${slash[3]}`;
    }

    // yyyy-MM-dd
    const iso = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (iso) {
      return `**/**/${iso[1]}`;
    }

    // Any other format that still contains a 4-digit year
    const year = normalized.match(/(19|20)\d{2}/)?.[0];
    if (year) {
      return `**/**/${year}`;
    }

    return this.fullMask('date_of_birth');
  }

  private maskKeepHeadTail(
    value: string,
    headVisible: number,
    tailVisible: number,
  ): string {
    if (!value) return value;
    if (value.length <= headVisible + tailVisible) {
      return '*'.repeat(value.length);
    }

    const maskedLen = value.length - headVisible - tailVisible;
    return `${value.slice(0, headVisible)}${'*'.repeat(maskedLen)}${value.slice(value.length - tailVisible)}`;
  }

  private maskCenterChars(value: string, maskCount: number): string {
    if (!value) return value;
    if (value.length <= maskCount) {
      return '*'.repeat(value.length);
    }

    const start = Math.floor((value.length - maskCount) / 2);
    const end = start + maskCount;
    return `${value.slice(0, start)}${'*'.repeat(maskCount)}${value.slice(end)}`;
  }

  private maskEmailKeepFirstN(value: string, keep: number): string {
    const atIndex = value.indexOf('@');
    if (atIndex <= 0) {
      return this.fullMask('email');
    }

    const local = value.slice(0, atIndex);
    const domain = value.slice(atIndex);
    const visible = Math.min(keep, local.length);
    const masked = '*'.repeat(Math.max(0, local.length - visible));
    return `${local.slice(0, visible)}${masked}${domain}`;
  }

  private maskEmailKeepLastOneBeforeAt(value: string): string {
    const atIndex = value.indexOf('@');
    if (atIndex <= 0) {
      return this.fullMask('email');
    }

    const local = value.slice(0, atIndex);
    const domain = value.slice(atIndex);
    if (local.length <= 1) {
      return `*${domain}`;
    }

    return `${local.slice(0, -1)}*${domain}`;
  }
}
