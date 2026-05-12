FROM node:22-alpine
WORKDIR /app
COPY package.json .
RUN npm install
COPY db/package.json ./db/
RUN cd db && npm install
COPY server.js .
COPY db/db.js ./db/
EXPOSE 3000
CMD ["node", "server.js"]
