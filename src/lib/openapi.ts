export const openApi = {
  openapi: "3.0.3",
  info: {
    title: "Oswal Service API",
    version: "1.0.0",
    description: "REST API for the service desk, the future WhatsApp bot, the technician app and Business Central. Send header x-api-key.",
  },
  servers: [{ url: "/api/v1" }],
  components: {
    securitySchemes: { ApiKey: { type: "apiKey", in: "header", name: "x-api-key" } },
  },
  security: [{ ApiKey: [] }],
  paths: {
    "/complaints": {
      get: { summary: "List complaints", parameters: [{ name: "page", in: "query" }, { name: "status", in: "query" }, { name: "q", in: "query" }, { name: "companyId", in: "query" }] },
      post: { summary: "Book a complaint" },
    },
    "/complaints/{ticketNo}": {
      get: { summary: "Fetch one complaint by Comp. No" },
      patch: { summary: "Assign, hold, close, happy-call or cancel" },
    },
    "/customers": { get: { summary: "Find customers by phone" } },
    "/products": { get: { summary: "List products" } },
  },
};
