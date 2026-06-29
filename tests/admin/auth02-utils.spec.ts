import { describe, expect, it } from "vitest";

import {
  formatInvitationRole,
  formatInvitationStatus,
  PASSWORD_RESET_REQUEST_MESSAGE,
  USERS_PIN_HELPER_COPY,
  validateInviteEmail,
  validateNewPassword
} from "../../apps/admin/src/lib/user-invite-utils";

describe("auth02 admin utils", () => {
  it("formats invitation status labels", () => {
    expect(formatInvitationStatus("PENDING")).toBe("Pending");
    expect(formatInvitationStatus("ACCEPTED")).toBe("Accepted");
    expect(formatInvitationStatus("REVOKED")).toBe("Revoked");
    expect(formatInvitationStatus("EXPIRED")).toBe("Expired");
  });

  it("formats invitation roles", () => {
    expect(formatInvitationRole("COMPANY_ADMIN")).toBe("Company admin");
  });

  it("validates invite email input", () => {
    expect(validateInviteEmail("")).toBe("Email is required.");
    expect(validateInviteEmail("not-an-email")).toBe("Enter a valid email address.");
    expect(validateInviteEmail("admin@example.com")).toBeNull();
  });

  it("validates new password strength for reset and invite forms", () => {
    expect(validateNewPassword("short")).toContain("8 characters");
    expect(validateNewPassword("allletters")).toContain("letter and one number");
    expect(validateNewPassword("GoodPass1")).toBeNull();
  });

  it("includes password reset helper copy", () => {
    expect(PASSWORD_RESET_REQUEST_MESSAGE).toContain("If an account exists");
  });

  it("clarifies PIN employees are separate from admin invites", () => {
    expect(USERS_PIN_HELPER_COPY).toContain("PIN");
    expect(USERS_PIN_HELPER_COPY.toLowerCase()).toContain("admin web access");
  });
});
