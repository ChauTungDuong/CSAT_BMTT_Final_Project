import { Injectable, NotFoundException } from '@nestjs/common';
import { CustomersService } from '../customers/customers.service';
import { AccountsService } from '../accounts/accounts.service';
import { AuditService } from '../../audit/audit.service';
import { Role } from '../../common/types/role.enum';

@Injectable()
export class TellerService {
  constructor(
    private customersService: CustomersService,
    private accountsService: AccountsService,
    private audit: AuditService,
  ) {}

  async searchCustomer(query: string, tellerId: string, ip: string) {
    await this.audit.log(
      'TELLER_SEARCH',
      tellerId,
      null,
      ip,
      `Query: ${query.slice(0, 50)}`,
    );
    return this.customersService.search(query);
  }

  async getAllCustomers(tellerId: string, ip: string) {
    await this.audit.log('TELLER_LIST_CUSTOMERS', tellerId, null, ip, '');
    return this.customersService.listForTeller();
  }

  async getCustomerForTeller(customerId: string, tellerId: string, ip: string) {
    return this.customersService.getProfile(
      customerId,
      tellerId,
      Role.TELLER,
      false,
      ip,
    );
  }

  async getAccountsForTeller(customerId: string, tellerId: string, ip: string) {
    return this.accountsService.getAccountsForTeller(customerId, tellerId, ip);
  }
}
