const TEAM_FORMATS = {
  SOLO: 1,
  DUO: 2,
  TRIO: 3,
  SQUAD: 4,
};

const getTeamFormat = ({ teamMode, gameMode, teamSize } = {}) => {
  const candidates = [teamMode, gameMode]
    .filter(Boolean)
    .map((mode) => String(mode).toUpperCase());
  if (new Set(candidates).size > 1) return null;

  const mode = candidates[0] || Object.keys(TEAM_FORMATS).find(
    (format) => TEAM_FORMATS[format] === Number(teamSize)
  );
  if (!mode || !TEAM_FORMATS[mode]) return null;
  if (teamSize !== undefined && Number(teamSize) !== TEAM_FORMATS[mode]) return null;

  return { teamMode: mode, gameMode: mode, teamSize: TEAM_FORMATS[mode] };
};

const isValidTeamRegistration = (registration, event) => {
  const eventFormat = getTeamFormat(event);
  const registrationFormat = getTeamFormat(registration);
  if (
    !eventFormat ||
    !registrationFormat ||
    String(registration?.teamMode || '').toUpperCase() !== eventFormat.teamMode ||
    registrationFormat.teamMode !== eventFormat.teamMode ||
    registrationFormat.teamSize !== eventFormat.teamSize
  ) {
    return false;
  }

  const players = registration.players;
  if (!Array.isArray(players) || players.length !== eventFormat.teamSize) {
    return false;
  }

  const uids = [];
  for (const player of players) {
    const name = typeof player.playerName === 'string' ? player.playerName.trim() : '';
    const uid = typeof player.freeFireUid === 'string' ? player.freeFireUid.trim() : '';
    if (name.length < 2 || name.length > 50 || !/^\d{1,20}$/.test(uid)) {
      return false;
    }
    uids.push(uid);
  }

  return new Set(uids).size === uids.length;
};

module.exports = { TEAM_FORMATS, getTeamFormat, isValidTeamRegistration };
