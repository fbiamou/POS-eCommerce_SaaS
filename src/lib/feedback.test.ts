import { describe, expect, it } from "vitest";
import { feedbackFromError, readFeedbackParam } from "./feedback";

describe("feedbackFromError", () => {
  it("passes through the codes raised by the updated database functions", () => {
    expect(feedbackFromError({ message: "insufficient_stock" })).toBe("insufficient_stock");
    expect(feedbackFromError({ message: "payment_exceeds_balance" })).toBe("payment_exceeds_balance");
  });

  it("maps the English messages of the older database functions", () => {
    expect(feedbackFromError({ message: "Unauthorized shop access" })).toBe("unauthorized_shop");
    expect(feedbackFromError({ message: "Not enough stock for product 5aea244a" })).toBe("insufficient_stock");
    expect(feedbackFromError({ message: "Product 5aea244a is not available" })).toBe("product_not_found");
    expect(feedbackFromError({ message: "Customer phone is required" })).toBe("required_fields_missing");
  });

  it("never lets an unknown technical message reach the user", () => {
    expect(feedbackFromError({ message: 'duplicate key value violates unique constraint "x"' })).toBe("generic_error");
    expect(feedbackFromError(null)).toBe("generic_error");
  });
});

describe("readFeedbackParam", () => {
  it("only accepts known codes from a URL", () => {
    expect(readFeedbackParam("profile_updated")).toBe("profile_updated");
    expect(readFeedbackParam("Your account is suspended, call +000")).toBeNull();
    expect(readFeedbackParam(undefined)).toBeNull();
  });
});
