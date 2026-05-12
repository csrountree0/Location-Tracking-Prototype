FROM node:22-alpine
WORKDIR /app
COPY package.json .
RUN npm install
COPY db_subscriber.js db.js ./
CMD ["node", "db_subscriber.js"]
