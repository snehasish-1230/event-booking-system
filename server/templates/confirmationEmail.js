const { format } = require('date-fns');
const env = require('../config/env');
const escapeHtml = require('../utils/escapeHtml');

/**
 * Generates a professional HTML email for registration confirmation.
 * All user-supplied values are HTML-escaped before insertion.
 */
const generateConfirmationEmail = ({
  userName,
  eventTitle,
  eventDate,
  eventTime,
  venue,
  city,
  confirmationCode,
  eventSlug,
}) => {
  const safeUserName = escapeHtml(userName);
  const safeEventTitle = escapeHtml(eventTitle);
  const safeEventTime = escapeHtml(eventTime);
  const safeVenue = escapeHtml(venue);
  const safeCity = escapeHtml(city);
  const safeConfirmationCode = escapeHtml(confirmationCode);
  const safeEventSlug = escapeHtml(eventSlug);

  const formattedDate = format(new Date(eventDate), 'MMMM dd, yyyy');
  const eventUrl = `${env.CLIENT_URL}/events/${safeEventSlug}`;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Registration Confirmed</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f7;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f7;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
          
          <!-- Header -->
          <tr>
            <td style="background-color:#4F46E5;padding:32px 40px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;">Registration Confirmed!</h1>
              <p style="margin:8px 0 0;color:#c7d2fe;font-size:14px;">You're all set for the event</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px 40px;">
              <p style="margin:0 0 16px;color:#374151;font-size:16px;line-height:1.6;">
                Hi <strong>${safeUserName}</strong>,
              </p>
              <p style="margin:0 0 24px;color:#374151;font-size:16px;line-height:1.6;">
                Your registration for <strong>${safeEventTitle}</strong> has been confirmed. Here are your event details:
              </p>

              <!-- Event Details -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f9fafb;border-radius:8px;padding:24px;margin-bottom:24px;">
                <tr>
                  <td style="padding:8px 24px;">
                    <p style="margin:0 0 12px;color:#374151;font-size:15px;">
                      &#x1F4C5; <strong>Date:</strong> ${formattedDate}
                    </p>
                    <p style="margin:0 0 12px;color:#374151;font-size:15px;">
                      &#x1F550; <strong>Time:</strong> ${safeEventTime}
                    </p>
                    <p style="margin:0 0 12px;color:#374151;font-size:15px;">
                      &#x1F4CD; <strong>Location:</strong> ${safeVenue}, ${safeCity}
                    </p>
                    <p style="margin:0;color:#374151;font-size:15px;">
                      &#x1F3AB; <strong>Confirmation Code:</strong>
                    </p>
                  </td>
                </tr>
              </table>

              <!-- Confirmation Code Box -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
                <tr>
                  <td align="center">
                    <div style="display:inline-block;padding:16px 32px;border:2px dashed #4F46E5;border-radius:8px;background-color:#eef2ff;">
                      <span style="font-family:'Courier New',Courier,monospace;font-size:28px;font-weight:700;color:#4F46E5;letter-spacing:3px;">
                        ${safeConfirmationCode}
                      </span>
                    </div>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 24px;color:#6b7280;font-size:14px;text-align:center;">
                Please save this confirmation code for check-in at the event.
              </p>

              <!-- CTA Button -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:8px 0 16px;">
                    <a href="${eventUrl}" target="_blank" style="display:inline-block;padding:14px 32px;background-color:#4F46E5;color:#ffffff;text-decoration:none;font-size:16px;font-weight:600;border-radius:6px;">
                      View Event
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#f9fafb;padding:24px 40px;text-align:center;border-top:1px solid #e5e7eb;">
              <p style="margin:0 0 4px;color:#9ca3af;font-size:13px;">
                &copy; ${new Date().getFullYear()} ${escapeHtml(env.EMAIL_FROM_NAME)}. All rights reserved.
              </p>
              <p style="margin:0;color:#9ca3af;font-size:12px;">
                This is an automated email. Please do not reply directly.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
};

module.exports = generateConfirmationEmail;
