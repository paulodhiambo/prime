FROM node:22-alpine

WORKDIR /app

# Copy dependency definitions
COPY package*.json ./

# Install production dependencies
RUN npm ci --omit=dev || npm install --omit=dev

# Copy application source code
COPY . .

# Ensure data directory exists for SQLite storage
RUN mkdir -p data

EXPOSE 3000

ENV NODE_ENV=production
CMD ["node", "server.js"]
