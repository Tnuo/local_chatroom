FROM node:18-alpine AS client-builder

WORKDIR /client

COPY client/package.json ./
RUN npm install

COPY client/ ./
RUN npm run build

FROM node:18-alpine

WORKDIR /app

COPY server/package.json ./
RUN npm install --omit=dev

COPY server/ ./
COPY --from=client-builder /client/dist /app/client/dist

RUN mkdir -p /app/data /app/uploads

EXPOSE 3000

CMD ["node", "index.js"]
