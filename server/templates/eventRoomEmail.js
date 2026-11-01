const { format } = require('date-fns');
const env = require('../config/env');
const escapeHtml = require('../utils/escapeHtml');

const generateEventRoomEmail = ({
  userName,
  eventTitle,
  roomId,
  roomPassword,
  slotNumber,
  matchAt,
  teamMode,
  teamSize,
  players,
  registrationId,
  instructions,
}) => {
  const clientUrl = env.CLIENT_URL.split(',')[0].trim().replace(/\/+$/, '');
  const ticketUrl = `${clientUrl}/tickets/${encodeURIComponent(registrationId)}`;
  const roster = players
    .map((player) => `<li>${escapeHtml(player.playerName)} — UID ${escapeHtml(player.freeFireUid)}</li>`)
    .join('');

  return `
<!DOCTYPE html>
<html lang="en">
  <body style="font-family:Arial,Helvetica,sans-serif;color:#1f2937;line-height:1.6">
    <h2>Free Fire room details are available</h2>
    <p>Hi ${escapeHtml(userName)},</p>
    <p>These credentials are only for your team&apos;s match in <strong>${escapeHtml(eventTitle)}</strong> (${escapeHtml(teamMode)}, ${escapeHtml(teamSize)} player${Number(teamSize) === 1 ? '' : 's'}).</p>
    <p><strong>Room ID:</strong> ${escapeHtml(roomId)}<br>
      <strong>Room password:</strong> ${escapeHtml(roomPassword)}<br>
      <strong>Slot:</strong> ${escapeHtml(slotNumber)}<br>
      <strong>Match:</strong> ${escapeHtml(format(new Date(matchAt), 'MMMM dd, yyyy HH:mm'))}</p>
    <p><strong>Registered team</strong></p>
    <ul>${roster}</ul>
    ${instructions ? `<p><strong>Important instructions:</strong><br>${escapeHtml(instructions).replace(/\n/g, '<br>')}</p>` : ''}
    <p><a href="${escapeHtml(ticketUrl)}">View your dashboard ticket</a></p>
  </body>
</html>`;
};

module.exports = generateEventRoomEmail;
