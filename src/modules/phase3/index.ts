import type { DealerOrderPort, SchemeClaimPort } from "../contracts";

export const dealerOrders: DealerOrderPort = {
  async placeSpareRequest() {
    throw new Error("The dealer portal arrives in Phase 3. Dealer logins can already book complaints.");
  },
};

export const schemeClaims: SchemeClaimPort = {
  async openClaim() {
    throw new Error("Insurance and scheme claim files arrive in Phase 3. Scheme complaints can already be booked.");
  },
};
