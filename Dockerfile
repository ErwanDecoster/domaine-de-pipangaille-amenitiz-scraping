ARG BUILD_FROM=node:24-alpine
FROM ${BUILD_FROM}

# Install additional dependencies
RUN apk add --no-cache \
  jq \
  ca-certificates \
  chromium \
  chromium-chromedriver

# Create app directory
WORKDIR /app

# Copy package files
COPY rootfs/app/package*.json ./

# Install Node.js dependencies
RUN npm install --only=production --no-optional

# Copy application files
COPY rootfs/app/src ./src

# Create data directory for session and exports
RUN mkdir -p /data/session /data/data /data/screenshots

# Copy run script
COPY run.sh /
RUN chmod +x /run.sh

# Health check
HEALTHCHECK --interval=60s --timeout=10s --start-period=30s --retries=3 \
  CMD sh -c "node -e \"const p = process.env.PORT || 3000; require('http').get(\\`http://localhost:${p}/api/health\\`, (r) => { if (r.statusCode !== 200) throw new Error(r.statusCode); }).on('error', (e) => { throw e; });\""

# Set environment
ENV NODE_ENV=production
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

CMD ["/run.sh"]
