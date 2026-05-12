FROM node:22-alpine
WORKDIR /app
COPY package.json .
RUN npm install
COPY broker.js .
EXPOSE 1883
CMD ["node", "broker.js"]
