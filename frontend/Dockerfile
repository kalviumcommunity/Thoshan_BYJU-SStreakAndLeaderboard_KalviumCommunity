# ─────────────────────────────────────────────
# Stage 1 – Builder
# Build the Vite + React + TypeScript app
# ─────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files and install all dependencies (including devDeps for build)
COPY package.json package-lock.json ./
RUN npm ci

# Copy source code
COPY . .

# Build the production static files
# VITE_API_URL is set at build time via docker-compose build args
ARG VITE_API_URL=http://localhost:5000
ENV VITE_API_URL=${VITE_API_URL}

RUN npm run build

# ─────────────────────────────────────────────
# Stage 2 – Production Web Server (Nginx)
# ─────────────────────────────────────────────
FROM nginx:1.27-alpine AS runner

# Remove default Nginx static content
RUN rm -rf /usr/share/nginx/html/*

# Copy built files from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Nginx config to support React Router (SPA fallback)
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
