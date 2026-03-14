FROM node:20-alpine

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

COPY package.json ./

# No package-lock.json in this repo, so use install (not ci)
RUN npm install --omit=dev

COPY server.js ./server.js
COPY views ./views
COPY public ./public

# Data and uploads live outside the image by default
RUN mkdir -p /app/uploads

EXPOSE 3000

CMD ["node", "server.js"]

