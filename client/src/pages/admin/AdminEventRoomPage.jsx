import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import * as adminService from '../../services/adminService';
import useDocumentTitle from '../../hooks/useDocumentTitle';

const isEligible = (registration, event) => {
  if (typeof registration.roomEligible === 'boolean') {
    return registration.roomEligible;
  }
  if (registration.status !== 'confirmed') return false;
  const paid =
    event.pricingType === 'PAID' || Number(event.price) > 0;
  return paid
    ? registration.paymentStatus === 'APPROVED'
    : registration.paymentStatus === 'NOT_REQUIRED';
};

const toLocalDateTime = (value) => {
  if (!value) return '';
  const date = new Date(value);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
};

const TEAM_MODE_SIZES = { SOLO: 1, DUO: 2, TRIO: 3, SQUAD: 4 };

const getEventTeamMode = (event) => {
  const declaredMode = String(event?.teamMode || event?.gameMode || '').toUpperCase();
  if (TEAM_MODE_SIZES[declaredMode]) return declaredMode;
  return Object.keys(TEAM_MODE_SIZES).find(
    (mode) => TEAM_MODE_SIZES[mode] === Number(event?.teamSize)
  ) || '';
};

const AdminEventRoomPage = () => {
  const { id: eventId } = useParams();
  const navigate = useNavigate();
  const [eventOptions, setEventOptions] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState('');
  const [event, setEvent] = useState(null);
  const [registrations, setRegistrations] = useState([]);
  const [room, setRoom] = useState(null);
  const [roomId, setRoomId] = useState('');
  const [roomPassword, setRoomPassword] = useState('');
  const [matchAt, setMatchAt] = useState('');
  const [instructions, setInstructions] = useState('');
  const [slots, setSlots] = useState({});
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendingFailed, setResendingFailed] = useState(false);

  useDocumentTitle(event ? `Room Management — ${event.title}` : 'Room Management');

  const loadRoom = useCallback(async () => {
    if (!eventId) return;
    try {
      setLoading(true);
      const response = await adminService.getEventRoom(eventId);
      const data = response.data || response;
      setEvent(data.event);
      setRegistrations(data.registrations || []);
      setRoom(data.room || null);
      const currentDetails = data.room?.draft || data.room;
      setRoomId(currentDetails?.roomId || '');
      setRoomPassword(currentDetails?.roomPassword || '');
      setMatchAt(toLocalDateTime(currentDetails?.matchAt));
      setInstructions(currentDetails?.instructions || '');

      const eligible = (data.registrations || []).filter((registration) =>
        isEligible(registration, data.event)
      );
      const savedSlots = new Map(
        (currentDetails?.assignments || []).map((assignment) => [
          String(assignment.registration),
          assignment.slotNumber,
        ])
      );
      const usedSlots = new Set(savedSlots.values());
      let nextSlot = 1;
      const initialSlots = {};
      eligible.forEach((registration) => {
        const id = registration._id;
        if (savedSlots.has(id)) {
          initialSlots[id] = savedSlots.get(id);
        } else {
          while (usedSlots.has(nextSlot)) nextSlot += 1;
          initialSlots[id] = nextSlot;
          usedSlots.add(nextSlot);
          nextSlot += 1;
        }
      });
      setSlots(initialSlots);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to load this event room.');
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    if (eventId) {
      loadRoom();
      return undefined;
    }

    let active = true;
    setLoading(true);
    const loadEventOptions = async () => {
      try {
        const firstResponse = await adminService.getEvents({ page: 1, limit: 50 });
        const firstData = firstResponse.data || firstResponse;
        const allEvents = firstData.events || (Array.isArray(firstData) ? firstData : []);
        const totalPages = firstData.pagination?.pages || 1;
        const remainingPages = await Promise.all(
          Array.from({ length: Math.max(0, totalPages - 1) }, (_, index) =>
            adminService.getEvents({ page: index + 2, limit: 50 })
          )
        );
        for (const response of remainingPages) {
          const data = response.data || response;
          allEvents.push(...(data.events || (Array.isArray(data) ? data : [])));
        }
        if (active) {
          setEventOptions(allEvents.filter((item) => getEventTeamMode(item)));
        }
      } catch (error) {
        if (active) {
          toast.error(error.response?.data?.message || 'Failed to load tournaments.');
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    loadEventOptions();

    return () => {
      active = false;
    };
  }, [eventId, loadRoom]);

  const handleSelectEvent = (e) => {
    e.preventDefault();
    if (!selectedEventId) {
      toast.error('Select a tournament to manage its room.');
      return;
    }
    navigate(`/admin/room-management/${selectedEventId}`);
  };

  const eligibleRegistrations = registrations.filter((registration) =>
    isEligible(registration, event || {})
  );
  const visibleRegistrations = useMemo(() => registrations.filter((registration) => {
    const matchesStatus = statusFilter === 'all' || registration.status === statusFilter;
    const query = search.trim().toLowerCase();
    const matchesSearch = !query || [
      registration.user?.name,
      registration.user?.email,
      ...(registration.players || []).flatMap((player) => [
        player.playerName,
        player.freeFireUid,
      ]),
    ].some((value) => String(value || '').toLowerCase().includes(query));
    return matchesStatus && matchesSearch;
  }), [registrations, search, statusFilter]);
  const registrationStats = useMemo(() => ({
    teams: registrations.length,
    players: registrations.reduce((sum, registration) => sum + (registration.players?.length || 0), 0),
    confirmed: registrations.filter((registration) => registration.status === 'confirmed').length,
    pending: registrations.filter((registration) => registration.paymentStatus === 'PENDING').length,
    approved: registrations.filter((registration) => registration.paymentStatus === 'APPROVED').length,
    rejected: registrations.filter((registration) => registration.paymentStatus === 'REJECTED').length,
  }), [registrations]);
  const assignedSlots = eligibleRegistrations.map((registration) =>
    Number(slots[registration._id])
  );
  const slotsAreValid =
    eligibleRegistrations.length > 0 &&
    assignedSlots.every((slot) => Number.isInteger(slot) && slot > 0) &&
    new Set(assignedSlots).size === assignedSlots.length;

  const getDraftPayload = () => ({
    roomId: roomId.trim(),
    roomPassword: roomPassword.trim(),
    matchAt: new Date(matchAt).toISOString(),
    instructions: instructions.trim(),
    assignments: eligibleRegistrations.map((registration) => ({
      registrationId: registration._id,
      slotNumber: Number(slots[registration._id]),
    })),
  });

  const validateRoomForm = () => {
    if (!roomId.trim() || !roomPassword.trim() || !matchAt) {
      toast.error('Enter the room ID, password, and match date and time.');
      return false;
    }
    if (eligibleRegistrations.length && !slotsAreValid) {
      toast.error('Assign a unique positive slot number to every eligible team.');
      return false;
    }
    return true;
  };

  const handleSaveDraft = async (e) => {
    e.preventDefault();
    if (saving || publishing || !validateRoomForm()) return;
    setSaving(true);
    try {
      await adminService.saveEventRoomDraft(eventId, getDraftPayload());
      toast.success('Room details saved. They are not visible to users until published.');
      await loadRoom();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to save room details.');
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async (e) => {
    e.preventDefault();
    if (saving || publishing || !validateRoomForm()) return;
    if (!window.confirm(`Publish room credentials to ${eligibleRegistrations.length} eligible team(s) for ${event.title}?`)) {
      return;
    }
    setPublishing(true);
    try {
      const payload = getDraftPayload();
      await adminService.saveEventRoomDraft(eventId, payload);
      const response = await adminService.publishEventRoom(eventId, payload);
      const data = response.data || response;
      setRoom(data.room);
      toast.success(
        `Published to ${data.eligibleCount} eligible teams. ${data.emailsSent} emails sent, ${data.emailsFailed} failed, ${data.emailsSkipped} duplicate sends skipped, ${data.skippedRegistrations} registrations ineligible.`
      );
      await loadRoom();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to publish room details.');
    } finally {
      setPublishing(false);
    }
  };

  const handleResendFailed = async () => {
    if (resendingFailed) return;
    setResendingFailed(true);
    try {
      const response = await adminService.resendFailedRoomEmails(eventId);
      const data = response.data || response;
      toast.success(`${data.emailsSent} resent, ${data.emailsFailed} still failed, ${data.emailsSkipped} skipped.`);
      await loadRoom();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to resend room emails.');
    } finally {
      setResendingFailed(false);
    }
  };

  const handleResendAll = async () => {
    if (resending || !window.confirm(`Resend the current room details to eligible teams for ${event.title}?`)) {
      return;
    }
    setResending(true);
    try {
      const response = await adminService.resendRoomEmails(eventId);
      const data = response.data || response;
      toast.success(`${data.emailsSent} emails sent, ${data.emailsFailed} failed, ${data.emailsSkipped} skipped.`);
      await loadRoom();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to resend room emails.');
    } finally {
      setResending(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl space-y-4">
        <div className="h-8 w-64 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
        <div className="h-72 animate-pulse rounded-xl bg-gray-200 dark:bg-gray-700" />
      </div>
    );
  }

  if (!eventId) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Room Management
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Select a Free Fire tournament to manage its room credentials and team slots.
          </p>
        </div>
        <form
          onSubmit={handleSelectEvent}
          className="space-y-4 rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800 sm:p-6"
        >
          <label
            htmlFor="room-management-event"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            Tournament
          </label>
          <select
            id="room-management-event"
            value={selectedEventId}
            onChange={(e) => setSelectedEventId(e.target.value)}
            disabled={eventOptions.length === 0}
            className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-gray-900 focus:border-primary-500 focus:ring-2 focus:ring-primary-500 disabled:cursor-not-allowed disabled:bg-gray-100 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:disabled:bg-gray-800"
          >
            <option value="">
              {eventOptions.length ? 'Select a tournament' : 'No team-mode tournaments found'}
            </option>
            {eventOptions.map((item) => {
              const mode = getEventTeamMode(item);
              return (
                <option key={item._id} value={item._id}>
                  {item.title} · {mode} ({TEAM_MODE_SIZES[mode]} players) · {item.status}
                </option>
              );
            })}
          </select>
          {eventOptions.length > 0 && (
            <button
              type="submit"
              disabled={!selectedEventId}
              className="rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Manage Room
            </button>
          )}
        </form>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="mx-auto max-w-3xl rounded-xl border border-gray-200 bg-white p-8 text-center dark:border-gray-700 dark:bg-gray-800">
        <p className="text-gray-700 dark:text-gray-300">Event room details could not be loaded.</p>
        <Link to="/admin/events" className="mt-4 inline-block text-primary-600 hover:underline dark:text-primary-400">
          Back to events
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <Link to="/admin/events" className="text-sm font-medium text-primary-600 hover:underline dark:text-primary-400">
          ← Back to Events
        </Link>
        <h1 className="mt-3 text-2xl font-bold text-gray-900 dark:text-white">{event.title}</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {event.gameMode || event.teamMode} · {event.teamSize || 1} player(s) per team · {eligibleRegistrations.length} eligible team(s)
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[
          ['Registered Teams', registrationStats.teams],
          ['Registered Players', registrationStats.players],
          ['Confirmed', registrationStats.confirmed],
          ['Pending Payment', registrationStats.pending],
          ['Approved', registrationStats.approved],
          ['Rejected', registrationStats.rejected],
        ].map(([label, count]) => (
          <div key={label} className="rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800">
            <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
            <p className="mt-1 text-xl font-bold text-gray-900 dark:text-white">{count}</p>
          </div>
        ))}
      </div>

      <form onSubmit={handlePublish} className="space-y-5 rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800 sm:p-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Room Management
          </h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Only confirmed registrations with approved payment for paid events can be assigned and notified.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Room ID
            <input
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              maxLength={80}
              required
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            />
          </label>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Room Password
            <input
              value={roomPassword}
              onChange={(e) => setRoomPassword(e.target.value)}
              maxLength={80}
              required
              autoComplete="new-password"
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            />
          </label>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 sm:col-span-2">
            Match Date and Time
            <input
              type="datetime-local"
              value={matchAt}
              onChange={(e) => setMatchAt(e.target.value)}
              required
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            />
          </label>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 sm:col-span-2">
            Important Instructions (Optional)
            <textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              maxLength={1000}
              rows={3}
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            />
          </label>
        </div>

        <div className="space-y-3">
          <h3 className="font-semibold text-gray-900 dark:text-white">Event registrations and slots</h3>
          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search teams, players, or UIDs"
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            >
              <option value="all">All statuses</option>
              <option value="pending">Pending</option>
              <option value="confirmed">Confirmed</option>
              <option value="cancelled">Cancelled</option>
              <option value="attended">Attended</option>
            </select>
          </div>
          {visibleRegistrations.length === 0 ? (
            <p className="rounded-lg bg-gray-50 p-4 text-sm text-gray-600 dark:bg-gray-900 dark:text-gray-400">
              No registrations exist for this event.
            </p>
          ) : visibleRegistrations.map((registration) => {
            const eligible = isEligible(registration, event);
            return (
              <article key={registration._id} className="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 dark:text-white">
                      {registration.user?.name || 'Unknown registrant'}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {registration.user?.email || 'No email'} · {registration.status}
                      {event.pricingType === 'PAID' && ` · ${registration.paymentStatus}`}
                    </p>
                    {(registration.players || []).length > 0 && (
                      <p className="mt-2 text-xs font-semibold text-primary-700 dark:text-primary-300">
                        {registration.teamMode || registration.gameMode || event.teamMode || event.gameMode || 'Team'} · {registration.players.length} player{registration.players.length === 1 ? '' : 's'}
                      </p>
                    )}
                    <ul className="mt-2 space-y-1 text-sm text-gray-700 dark:text-gray-300">
                      {(registration.players || []).map((player, index) => (
                        <li key={`${registration._id}-${player.freeFireUid}`}>
                          {index === 0 ? 'Team Leader' : `Player ${index + 1}`}: {player.playerName} · UID {player.freeFireUid}
                        </li>
                      ))}
                    </ul>
                    {eligible && room?.status === 'published' && (
                      <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                        Email: {room.assignments?.find((assignment) =>
                          String(assignment.registration?._id || assignment.registration) === registration._id
                        )?.emailStatus || 'not sent'}
                      </p>
                    )}
                  </div>
                  <label className="shrink-0 text-sm font-medium text-gray-700 dark:text-gray-300">
                    Slot number
                    <input
                      type="number"
                      min={1}
                      max={100000}
                      value={slots[registration._id] ?? ''}
                      disabled={!eligible}
                      onChange={(e) =>
                        setSlots((current) => ({ ...current, [registration._id]: e.target.value }))
                      }
                      className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 disabled:bg-gray-100 disabled:text-gray-400 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:disabled:bg-gray-800"
                    />
                    {!eligible && (
                      <span className="mt-1 block text-xs text-amber-700 dark:text-amber-400">
                        Not eligible for room details
                      </span>
                    )}
                  </label>
                </div>
              </article>
            );
          })}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={handleSaveDraft}
          disabled={saving || publishing}
          className="inline-flex w-full items-center justify-center rounded-lg border border-primary-600 px-5 py-3 font-semibold text-primary-700 hover:bg-primary-50 disabled:cursor-not-allowed disabled:opacity-50 dark:text-primary-300 dark:hover:bg-primary-950/30 sm:w-auto"
        >
          {saving ? 'Saving…' : room?.status === 'published' ? 'Update Room Details' : 'Save Room Details'}
        </button>
        <button
          type="submit"
          disabled={publishing || saving || (eligibleRegistrations.length > 0 && !slotsAreValid)}
          className="inline-flex w-full items-center justify-center rounded-lg bg-primary-600 px-5 py-3 font-semibold text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
        >
          {publishing ? 'Publishing…' : room?.status === 'published' ? 'Update Room Details & Publish' : 'Publish & Send'}
        </button>
        {room?.status === 'published' && (
          <>
          <button
            type="button"
            onClick={handleResendAll}
            disabled={resending || resendingFailed || publishing || saving}
            className="inline-flex w-full items-center justify-center rounded-lg border border-primary-600 px-5 py-3 font-semibold text-primary-700 hover:bg-primary-50 disabled:cursor-not-allowed disabled:opacity-50 dark:text-primary-300 dark:hover:bg-primary-950/30 sm:w-auto"
          >
            {resending ? 'Resending…' : 'Resend Email'}
          </button>
          <button
            type="button"
            onClick={handleResendFailed}
            disabled={resending || resendingFailed || publishing || saving}
            className="inline-flex w-full items-center justify-center rounded-lg border border-amber-500 px-5 py-3 font-semibold text-amber-700 hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-50 dark:text-amber-300 dark:hover:bg-amber-950/30 sm:w-auto"
          >
            {resendingFailed ? 'Retrying…' : 'Resend Failed Email'}
          </button>
          </>
        )}
        </div>
      </form>

      {room && (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {room.status === 'published'
            ? `Last published ${new Date(room.publishedAt).toLocaleString()}.`
            : 'Draft saved; details are not yet visible to users.'}
        </p>
      )}
    </div>
  );
};

export default AdminEventRoomPage;
