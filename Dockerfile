FROM node:22-alpine

# Set working directory
WORKDIR /app

# Install dependencies (production only)
COPY package*.json ./
RUN npm ci --omit=dev

# Copy application source code
COPY server.js db.js repository.js ./
COPY public/ ./public/

# Set environment defaults
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=6000

# Expose application port
EXPOSE 6000

# Run container as non-root node user
USER node

# Start the server
CMD ["node", "server.js"]
