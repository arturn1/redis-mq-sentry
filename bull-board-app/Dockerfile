# Dockerfile para Bull-board
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
# Ensure logs directory exists for queue logger persistence
RUN mkdir -p /app/logs
EXPOSE 4000
CMD ["npx", "ts-node", "index.ts"]
