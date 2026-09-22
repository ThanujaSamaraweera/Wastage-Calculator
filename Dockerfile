FROM node:22-alpine

# Set working directory
WORKDIR /app

# Install dependencies (production only)
COPY --chown=node:node package*.json ./
RUN npm ci --omit=dev

# Copy application source code
COPY --chown=node:node server.js db.js repository.js ./
COPY --chown=node:node public/ ./public/

# Set environment defaults
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=6500

# Expose application port
EXPOSE 6500

# Run container as non-root node user
USER node

# Start the server
CMD ["node", "server.js"]
