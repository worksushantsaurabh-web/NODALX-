FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force
COPY server/processing-worker.mjs server/processing-daemon.mjs server/gemini-processor.mjs server/rds-client.mjs server/nodalx-v3-result.mjs ./server/
COPY certs/rds-us-east-1-bundle.pem ./certs/
COPY scripts/start-cloud-processing-worker.mjs ./scripts/
USER node
CMD ["node", "scripts/start-cloud-processing-worker.mjs"]
