const { format } = require('date-fns');
const env = require('../config/env');
const escapeHtml = require('../utils/escapeHtml');

/**
 * Generates a professional HTML email notifying attendees
 * that the event itself has been cancelled by the organizer.
 * All user-supplied values are HTML-escaped before insertion.
 */
const generateEventCancelledEmail = ({
  userName,
  eventTitle,
  eventDate,
  venue,
  city,
  organizerName,
}) => {
  const safeUserName = escapeHtml(userName);
  const safeEventTitle = escapeHtml(eventTitle);
  const safeVenue = escapeHtml(venue);
  const safeCity = escapeHtml(city);
  const safeOrganizerName = escapeHtml(organizerName);

  const formattedDate = format(new Date(eventDate), 'MMMM dd, yyyy');
  const browseUrl = `${env.CLIENT_URL}/events`;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Event Cancelled</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f7;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f7;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
          
          <!-- Header -->
          <tr>
            <td style="background-color:#DC2626;padding:32px 40px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;">Event Cancelled</h1>
              <p style="margin:8px 0 0;color:#fecaca;font-size:14px;">We're sorry for the inconvenience</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px 40px;">
              <p style="margin:0 0 16px;color:#374151;font-size:16px;line-height:1.6;">
                Hi <strong>${safeUserName}</strong>,
              </p>
              <p style="margin:0 0 24px;color:#374151;font-size:16px;line-height:1.6;">
                We regret to inform you that <strong>${safeEventTitle}</strong> has been cancelled by the organizer <strong>${safeOrganizerName}</strong>. We sincerely apologize for any inconvenience this may cause.
              </p>

              <!-- Event Details -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#fef2f2;border-radius:8px;padding:24px;margin-bottom:24px;border-left:4px solid #DC2626;">
                <tr>
                  <td style="padding:8px 24px;">
                    <p style="margin:0 0 12px;color:#374151;font-size:15px;">
                      &#x1F4C5; <strong>Date:</strong> ${formattedDate}
                    </p>
                    <p style="margin:0;color:#374151;font-size:15px;">
                      &#x1F4CD; <strong>Location:</strong> ${safeVenue}, ${safeCity}
                    </p>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 24px;color:#6b7280;font-size:14px;line-height:1.6;">
                We encourage you to explore other upcoming events that might interest you.
              </p>

              <!-- CTA Button -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:8px 0 16px;">
                    <a href="${browseUrl}" target="_blank" style="display:inline-block;padding:14px 32px;background-color:#DC2626;color:#ffffff;text-decoration:none;font-size:16px;font-weight:600;border-radius:6px;">
                      Browse Other Events
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

module.exports = generateEventCancelledEmail;
