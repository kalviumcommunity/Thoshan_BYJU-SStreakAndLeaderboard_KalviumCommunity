const bcrypt = require('bcryptjs');
const prisma = require('../config/prisma');
const { generateToken } = require('../utils/jwt');

/**
 * Remove sensitive credentials before returning user data.
 * @param {Object} user
 * @returns {Object}
 */
function sanitizeUser(user) {
  if (!user) return null;
  const { passwordHash, ...safeUser } = user;
  return safeUser;
}

/**
 * Validate email format.
 * @param {string} email
 * @returns {boolean}
 */
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Register a new user with email and password.
 * Hashes password with bcrypt and returns a JWT token.
 *
 * @param {Object} params
 * @param {string} params.email - User email
 * @param {string} params.password - User plain-text password
 * @param {string} [params.name] - User display name
 * @returns {Promise<{ token: string, user: Object }>}
 */
async function registerUser({ email, password, name }) {
  if (!email || typeof email !== 'string' || !isValidEmail(email.trim())) {
    const error = new Error('A valid email address is required');
    error.statusCode = 400;
    throw error;
  }

  if (!password || typeof password !== 'string' || password.length < 6) {
    const error = new Error('Password must be at least 6 characters long');
    error.statusCode = 400;
    throw error;
  }

  const normalizedEmail = email.trim().toLowerCase();

  // Check if user already exists
  const existingUser = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (existingUser) {
    if (existingUser.passwordHash) {
      const error = new Error('An account with this email already exists');
      error.statusCode = 409;
      throw error;
    }

    // Existing Firebase user setting up a local password
    const passwordHash = await bcrypt.hash(password, 10);
    const updatedUser = await prisma.user.update({
      where: { id: existingUser.id },
      data: {
        passwordHash,
        name: name ? name.trim() : existingUser.name,
      },
    });

    const token = generateToken({
      id: updatedUser.id,
      email: updatedUser.email,
      name: updatedUser.name,
    });

    return {
      token,
      user: sanitizeUser(updatedUser),
    };
  }

  // Hash password
  const passwordHash = await bcrypt.hash(password, 10);

  // Create new user
  const user = await prisma.user.create({
    data: {
      email: normalizedEmail,
      passwordHash,
      name: name ? name.trim() : null,
    },
  });

  const token = generateToken({
    id: user.id,
    email: user.email,
    name: user.name,
  });

  return {
    token,
    user: sanitizeUser(user),
  };
}

/**
 * Authenticate user with email and password.
 * Verifies bcrypt hash and returns a JWT token.
 *
 * @param {Object} params
 * @param {string} params.email - User email
 * @param {string} params.password - User password
 * @returns {Promise<{ token: string, user: Object }>}
 */
async function loginUser({ email, password }) {
  if (!email || !password) {
    const error = new Error('Email and password are required');
    error.statusCode = 400;
    throw error;
  }

  const normalizedEmail = email.trim().toLowerCase();

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (!user || !user.passwordHash) {
    const error = new Error('Invalid email or password');
    error.statusCode = 401;
    throw error;
  }

  const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
  if (!isPasswordValid) {
    const error = new Error('Invalid email or password');
    error.statusCode = 401;
    throw error;
  }

  const token = generateToken({
    id: user.id,
    email: user.email,
    name: user.name,
  });

  return {
    token,
    user: sanitizeUser(user),
  };
}

/**
 * Retrieves a user record by internal UUID.
 *
 * @param {string} id - User UUID
 * @returns {Promise<Object|null>}
 */
async function getUserById(id) {
  if (!id) {
    throw new Error('User ID is required');
  }

  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      streakHistory: {
        orderBy: { date: 'desc' },
        take: 1,
      },
      weeklyScores: {
        orderBy: { weekStartDate: 'desc' },
        take: 1,
      },
    },
  });

  return sanitizeUser(user);
}

/**
 * Retrieves a user record by email.
 *
 * @param {string} email
 * @returns {Promise<Object|null>}
 */
async function getUserByEmail(email) {
  if (!email) return null;
  const user = await prisma.user.findUnique({
    where: { email: email.trim().toLowerCase() },
  });
  return sanitizeUser(user);
}

/**
 * Syncs a Firebase-authenticated user into the database.
 *
 * @param {Object} params
 * @param {string} params.firebaseUid - Unique Firebase UID
 * @param {string} params.email - User email
 * @param {string} [params.name] - Display name
 * @returns {Promise<{ user: Object, isNewUser: boolean }>}
 */
async function syncUser({ firebaseUid, email, name }) {
  if (!firebaseUid) {
    throw new Error('firebaseUid is required for user sync');
  }

  if (!email) {
    throw new Error('email is required for user sync');
  }

  const normalizedEmail = email.trim().toLowerCase();

  let user = await prisma.user.findUnique({
    where: { firebaseUid },
  });

  if (user) {
    if (name && name !== user.name) {
      user = await prisma.user.update({
        where: { firebaseUid },
        data: { name },
      });
    }
    return { user: sanitizeUser(user), isNewUser: false };
  }

  // Check if user exists by email without firebaseUid attached
  const existingByEmail = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (existingByEmail) {
    user = await prisma.user.update({
      where: { id: existingByEmail.id },
      data: {
        firebaseUid,
        name: name || existingByEmail.name,
      },
    });
    return { user: sanitizeUser(user), isNewUser: false };
  }

  // Create new user
  user = await prisma.user.create({
    data: {
      firebaseUid,
      email: normalizedEmail,
      name: name || null,
    },
  });

  return { user: sanitizeUser(user), isNewUser: true };
}

/**
 * Retrieves a user record by Firebase UID.
 *
 * @param {string} firebaseUid - Unique Firebase UID
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
        take: 1,
      },
      weeklyScores: {
        orderBy: { weekStartDate: 'desc' },
        take: 1,
      },
    },
  });

  return sanitizeUser(user);
}

module.exports = {
  registerUser,
  loginUser,
  getUserById,
  getUserByEmail,
  syncUser,
  getUserByFirebaseUid,
  sanitizeUser,
};
