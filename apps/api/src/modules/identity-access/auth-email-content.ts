type PasswordResetEmailInput = {
  recipientEmail: string;
  resetUrl: string;
  expiresMinutes: number;
};

type InvitationEmailInput = {
  recipientEmail: string;
  acceptUrl: string;
  companyName: string;
  roleLabel: string;
  expiresDays: number;
};

export function buildPasswordResetEmailSubject() {
  return "Reset your LaborLedger password";
}

export function buildInvitationEmailSubject() {
  return "You have been invited to LaborLedger";
}

export function buildPasswordResetEmailBodies(input: PasswordResetEmailInput) {
  const textBody = [
    `Hello,`,
    "",
    `We received a request to reset the LaborLedger password for ${input.recipientEmail}.`,
    "",
    `Reset your password: ${input.resetUrl}`,
    "",
    `This link expires in ${input.expiresMinutes} minutes.`,
    "",
    "If you did not request this reset, you can ignore this email.",
    "",
    "LaborLedger does not process payments, payroll, or accounting through password reset emails."
  ].join("\n");

  const htmlBody = [
    "<p>Hello,</p>",
    `<p>We received a request to reset the LaborLedger password for <strong>${escapeHtml(input.recipientEmail)}</strong>.</p>`,
    `<p><a href="${escapeHtml(input.resetUrl)}">Reset your password</a></p>`,
    `<p>This link expires in ${input.expiresMinutes} minutes.</p>`,
    "<p>If you did not request this reset, you can ignore this email.</p>"
  ].join("");

  return { textBody, htmlBody };
}

export function buildInvitationEmailBodies(input: InvitationEmailInput) {
  const textBody = [
    `Hello,`,
    "",
    `You have been invited to LaborLedger as ${input.roleLabel} for ${input.companyName}.`,
    "",
    `Accept your invitation: ${input.acceptUrl}`,
    "",
    `This invitation expires in ${input.expiresDays} days.`,
    "",
    "If you were not expecting this invitation, you can ignore this email."
  ].join("\n");

  const htmlBody = [
    "<p>Hello,</p>",
    `<p>You have been invited to LaborLedger as <strong>${escapeHtml(input.roleLabel)}</strong> for <strong>${escapeHtml(input.companyName)}</strong>.</p>`,
    `<p><a href="${escapeHtml(input.acceptUrl)}">Accept your invitation</a></p>`,
    `<p>This invitation expires in ${input.expiresDays} days.</p>`,
    "<p>If you were not expecting this invitation, you can ignore this email.</p>"
  ].join("");

  return { textBody, htmlBody };
}

function escapeHtml(value: string) {
  return value
    .replace(/&/gu, "&amp;")
    .replace(/</gu, "&lt;")
    .replace(/>/gu, "&gt;")
    .replace(/"/gu, "&quot;");
}
