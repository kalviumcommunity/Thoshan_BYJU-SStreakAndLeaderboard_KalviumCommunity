const prisma = require('../src/config/prisma');

async function dedupeStreakHistory() {
  console.log('[Migration Pre-Check] Checking and deduplicating StreakHistory records...');

  const allRecords = await prisma.streakHistory.findMany({
    orderBy: { date: 'asc' },
  });

  console.log(`[Migration Pre-Check] Found ${allRecords.length} total streak_history records.`);

  // Group by userId and normalized UTC midnight date string (YYYY-MM-DD)
  const grouped = new Map();

  for (const record of allRecords) {
    const rawDate = new Date(record.date);
    const y = rawDate.getUTCFullYear();
    const m = String(rawDate.getUTCMonth() + 1).padStart(2, '0');
    const d = String(rawDate.getUTCDate()).padStart(2, '0');
    const dayKey = `${record.userId}_${y}-${m}-${d}`;

    if (!grouped.has(dayKey)) {
      grouped.set(dayKey, []);
    }
    grouped.get(dayKey).push({
      ...record,
      normalizedDate: new Date(Date.UTC(y, rawDate.getUTCMonth(), rawDate.getUTCDate(), 0, 0, 0, 0)),
    });
  }

  let updatedCount = 0;
  let deletedCount = 0;

  for (const [key, records] of grouped.entries()) {
    // Sort so the highest streakCount or most recently updated is first
    records.sort((a, b) => b.streakCount - a.streakCount);

    const keeper = records[0];
    const duplicates = records.slice(1);

    // Delete duplicates if any
    for (const dup of duplicates) {
      await prisma.streakHistory.delete({
        where: { id: dup.id },
      });
      deletedCount++;
    }

    // Update keeper to ensure normalized UTC midnight date
    await prisma.streakHistory.update({
      where: { id: keeper.id },
      data: {
        date: keeper.normalizedDate,
      },
    });
    updatedCount++;
  }

  console.log(`[Migration Pre-Check] Finished: ${updatedCount} normalized, ${deletedCount} duplicate rows removed.`);
  await prisma.$disconnect();
}

dedupeStreakHistory().catch((err) => {
  console.error('[Migration Pre-Check] Error during deduplication:', err);
  process.exit(1);
});
