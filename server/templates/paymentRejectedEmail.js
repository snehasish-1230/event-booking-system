const escapeHtml = require('../utils/escapeHtml');

const generatePaymentRejectedEmail = ({ userName, eventTitle, rejectionReason }) => `
<!DOCTYPE html>
<html lang="en">
  <body style="font-family:Arial,Helvetica,sans-serif;color:#1f2937;line-height:1.6">
    <h2>Payment needs attention</h2>
    <p>Hi ${escapeHtml(userName)},</p>
    <p>We could not verify your payment for <strong>${escapeHtml(eventTitle)}</strong>.</p>
    <p><strong>Reason:</strong> ${escapeHtml(rejectionReason)}</p>
    <p>Please review the details and resubmit your payment information if appropriate.</p>
  </body>
</html>`;

module.exports = generatePaymentRejectedEmail;
