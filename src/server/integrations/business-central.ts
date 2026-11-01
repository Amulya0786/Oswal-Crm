import type { BusinessCentralClient } from "@/modules/contracts";

/**
 * Dynamics 365 Business Central hook.
 * Phase 3 should call pushClosedComplaint from the complaint close path
 * once a service account and company id are configured.
 */
export class BusinessCentralStub implements BusinessCentralClient {
  async pushClosedComplaint(): Promise<{ remoteId: string }> {
    throw new Error("Microsoft Dynamics 365 Business Central integration is planned for Phase 3.");
  }
}

export const businessCentral: BusinessCentralClient = new BusinessCentralStub();
