import { RestaurantTable, Waitlist } from '@/models';
import { AppError } from '@/utils/AppError';
import { emitToAdmins } from '@/realtime/emit';
import { TABLE_STATUS } from '@/constants';
import type { FilterQuery } from 'mongoose';

const ESTIMATED_MINUTES_PER_GROUP = 10;

export async function joinWaitlist(input: {
  guestName: string;
  phone: string;
  email: string;
  guestsCount: number;
}) {
  // Find current count of pending groups to get the position
  const activePendingCount = await Waitlist.countDocuments({ status: 'PENDING' });
  const position = activePendingCount + 1;

  const waitlist = await Waitlist.create({
    guestName: input.guestName,
    phone: input.phone,
    email: input.email,
    guestsCount: input.guestsCount,
    position,
    status: 'PENDING',
  });

  emitToAdmins('waitlist:updated', { action: 'JOIN', waitlist });
  return waitlist;
}

export async function checkWaitlistStatus(query: { phone?: string; email?: string }) {
  if (!query.phone && !query.email) {
    throw AppError.badRequest('Email or phone number is required to search waitlist status');
  }

  const filter: FilterQuery<any> = { status: 'PENDING' };
  if (query.phone) filter.phone = query.phone.trim();
  if (query.email) filter.email = query.email.trim();

  const entry = await Waitlist.findOne(filter);
  if (!entry) {
    // If not pending, search for most recent seated/cancelled status
    const recent = await Waitlist.findOne({
      $or: [{ phone: query.phone }, { email: query.email }],
    }).sort({ createdAt: -1 });

    if (!recent) {
      throw AppError.notFound('No active waitlist entry found');
    }
    return {
      status: recent.status,
      position: 0,
      estimatedWaitMinutes: 0,
      guestName: recent.guestName,
      guestsCount: recent.guestsCount,
    };
  }

  // Calculate live position based on pending entries before this one
  const groupsAhead = await Waitlist.countDocuments({
    status: 'PENDING',
    createdAt: { $lt: entry.createdAt },
  });

  const livePosition = groupsAhead + 1;
  const estimatedWaitMinutes = livePosition * ESTIMATED_MINUTES_PER_GROUP;

  return {
    status: entry.status,
    position: livePosition,
    estimatedWaitMinutes,
    guestName: entry.guestName,
    guestsCount: entry.guestsCount,
  };
}

export async function listWaitlist(query: { status?: string }) {
  const filter: FilterQuery<any> = {};
  if (query.status) {
    filter.status = query.status;
  }

  const items = await Waitlist.find(filter)
    .populate('assignedTable', 'number capacity')
    .sort({ position: 1, createdAt: 1 });

  // Recalculate dynamic positions for active lists
  if (!query.status || query.status === 'PENDING') {
    let currentPosition = 1;
    for (const item of items) {
      if (item.status === 'PENDING') {
        item.position = currentPosition++;
        await item.save();
      }
    }
  }

  return items;
}

export async function seatWaitlistGuest(id: string, tableId: string) {
  const waitlist = await Waitlist.findById(id);
  if (!waitlist) {
    throw AppError.notFound('Waitlist entry not found');
  }
  if (waitlist.status !== 'PENDING') {
    throw AppError.badRequest('Only pending waitlist entries can be seated');
  }

  const table = await RestaurantTable.findById(tableId);
  if (!table) {
    throw AppError.notFound('Restaurant table not found');
  }
  if (table.status !== TABLE_STATUS.AVAILABLE) {
    throw AppError.badRequest('Table is not available for seating');
  }

  // Seating guest
  table.status = TABLE_STATUS.OCCUPIED;
  await table.save();

  waitlist.status = 'SEATED';
  waitlist.assignedTable = table._id;
  waitlist.position = 0;
  await waitlist.save();

  // Shift remaining queue
  await recalculateQueuePositions();

  emitToAdmins('waitlist:updated', { action: 'SEATED', waitlist });
  emitToAdmins('table:status', { tableId: table._id, status: TABLE_STATUS.OCCUPIED, number: table.number });

  return waitlist;
}

export async function cancelWaitlistEntry(id: string) {
  const waitlist = await Waitlist.findById(id);
  if (!waitlist) {
    throw AppError.notFound('Waitlist entry not found');
  }

  waitlist.status = 'CANCELLED';
  waitlist.position = 0;
  await waitlist.save();

  await recalculateQueuePositions();

  emitToAdmins('waitlist:updated', { action: 'CANCEL', waitlist });
  return waitlist;
}

export async function autoAssignTables() {
  const pendingQueue = await Waitlist.find({ status: 'PENDING' }).sort({ createdAt: 1 });
  const availableTables = await RestaurantTable.find({ status: TABLE_STATUS.AVAILABLE }).sort({ capacity: 1 });

  const assigned: any[] = [];

  for (const guest of pendingQueue) {
    // Find smallest available table that fits the guest count
    const tableMatch = availableTables.find((t) => t.capacity >= guest.guestsCount);
    if (tableMatch) {
      // Seat guest
      tableMatch.status = TABLE_STATUS.OCCUPIED;
      await tableMatch.save();

      guest.status = 'SEATED';
      guest.assignedTable = tableMatch._id;
      guest.position = 0;
      await guest.save();

      // Remove table from available pool
      const index = availableTables.indexOf(tableMatch);
      if (index > -1) {
        availableTables.splice(index, 1);
      }

      assigned.push({ guest, table: tableMatch });

      emitToAdmins('table:status', { tableId: tableMatch._id, status: TABLE_STATUS.OCCUPIED, number: tableMatch.number });
    }
  }

  if (assigned.length > 0) {
    await recalculateQueuePositions();
    emitToAdmins('waitlist:updated', { action: 'AUTO_ASSIGN', count: assigned.length });
  }

  return assigned;
}

async function recalculateQueuePositions() {
  const pendingList = await Waitlist.find({ status: 'PENDING' }).sort({ createdAt: 1 });
  let position = 1;
  for (const item of pendingList) {
    item.position = position++;
    await item.save();
  }
}
