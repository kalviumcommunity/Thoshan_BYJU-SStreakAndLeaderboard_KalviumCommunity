# ─────────────────────────────────────────────
# Stage 1 – Dependencies
# ─────────────────────────────────────────────
FROM node:20-alpine AS deps

WORKDIR /app

# Copy package files and install production dependencies only
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy Prisma schema and generate the client
COPY prisma ./prisma
RUN npx prisma generate

# ─────────────────────────────────────────────
# Stage 2 – Production Image
# ─────────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

# Set production environment
ENV NODE_ENV=production
ENV PORT=5000

# Copy installed node_modules (with generated Prisma client) from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy application source code
COPY src ./src
COPY prisma ./prisma
COPY package.json ./

# Expose the API port
EXPOSE 5000

# Run DB migrations (if any pending) then start the server
CMD ["sh", "-c", "npx prisma migrate deploy && node src/server.js"]
