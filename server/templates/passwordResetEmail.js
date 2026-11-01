const env = require('../config/env');
const escapeHtml = require('../utils/escapeHtml');

const generatePasswordResetEmail = ({ userName, otp }) => {
  const safeUserName = escapeHtml(userName);
  const safeOtp = escapeHtml(otp);
  const brandName = escapeHtml(env.SMTP_FROM_NAME);

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Reset your EventBooking password</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f7;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f7;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 8px 28px rgba(31,41,55,0.12);">
          <tr>
            <td style="background:linear-gradient(135deg,#4f46e5,#7c3aed);padding:30px 36px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:25px;font-weight:700;">${brandName}</h1>
              <p style="margin:8px 0 0;color:#e0e7ff;font-size:14px;">Password reset verification</p>
            </td>
          </tr>
          <tr>
            <td style="padding:36px;">
              <p style="margin:0 0 16px;color:#374151;font-size:16px;line-height:1.6;">Hi ${safeUserName},</p>
              <p style="margin:0 0 24px;color:#4b5563;font-size:16px;line-height:1.6;">Use this six-digit code to verify your password reset request:</p>
              <p style="margin:0 0 24px;padding:18px;border-radius:12px;background-color:#eef2ff;color:#3730a3;text-align:center;font-size:32px;font-weight:700;letter-spacing:10px;">${safeOtp}</p>
              <p style="margin:0 0 12px;color:#4b5563;font-size:14px;line-height:1.6;">This code expires in <strong>5 minutes</strong>.</p>
              <p style="margin:0 0 12px;color:#6b7280;font-size:14px;line-height:1.6;">Never share this code with anyone. EventBooking staff will never ask you for it.</p>
              <p style="margin:0;color:#6b7280;font-size:14px;line-height:1.6;">If you did not request a password reset, you can safely ignore this email. Your password will not change unless you complete verification.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:18px 36px;background-color:#f9fafb;color:#9ca3af;text-align:center;font-size:12px;">&copy; ${new Date().getFullYear()} ${brandName}. All rights reserved.</td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
};

module.exports = generatePasswordResetEmail;
