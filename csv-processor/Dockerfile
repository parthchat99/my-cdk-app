FROM node:18-alpine

WORKDIR /app

# Copy and install
COPY package*.json ./
RUN npm install

# Copy the rest and build
COPY . .
RUN npx tsc

# Optional: prune dev dependencies
RUN npm prune --production

# 🔍 Debugging steps
RUN echo "DEBUG DIST CONTENTS:" && ls -al dist
RUN node -v
RUN cat dist/index.js || echo "index.js not found!"

CMD ["node", "dist/index.js"]
