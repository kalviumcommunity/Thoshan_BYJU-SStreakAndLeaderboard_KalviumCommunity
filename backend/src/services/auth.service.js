const prisma = require('../config/prisma');

/**
 * Syncs a Firebase-authenticated user into the PostgreSQL database.
 * If the user does not exist, creates a new User record.
 * If the user exists, returns the existing record (and updates profile info if provided).
 *
 * @param {Object} params
 * @param {string} params.firebaseUid - The unique Firebase UID (from decoded token)
 * @param {string} params.email - The user's email address (from decoded token or client)
 * @param {string} [params.name] - Optional display name
 * @returns {Promise<{ user: Object, isNewUser: boolean }>}
 */
async function syncUser({ firebaseUid, email, name }) {
  if (!firebaseUid) {
    throw new Error('firebaseUid is required for user sync');
  }

  if (!email) {
    throw new Error('email is required for user sync');
  }

  // Check if user already exists in PostgreSQL
  let user = await prisma.user.findUnique({
    where: { firebaseUid }
  });

  if (user) {
    // If name is provided and different, update it
    if (name && name !== user.name) {
      user = await prisma.user.update({
        where: { firebaseUid },
        data: { name }
      });
    }
    return { user, isNewUser: false };
  }

  // Create new user in PostgreSQL
  user = await prisma.user.create({
    data: {
      firebaseUid,
      email,
      name: name || null
    }
  });

  return { user, isNewUser: true };
}

/**
 * Retrieves a user record from PostgreSQL by their Firebase UID.
 *
 * @param {string} firebaseUid - The unique Firebase UID
 * @returns {Promise<Object|null>}
 */
async function getUserByFirebaseUid(firebaseUid) {
  if (!firebaseUid) {
    throw new Error('firebaseUid is required');
  }

  const user = await prisma.user.findUnique({
    where: { firebaseUid },
    include: {
      streakHistory: {
        orderBy: { date: 'desc' },
        take: 1
      },
      weeklyScores: {
        orderBy: { weekStartDate: 'desc' },
        take: 1
      }
    }
  });

  return user;
}

module.exports = {
  syncUser,
  getUserByFirebaseUid
};
