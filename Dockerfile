FROM node:18-alpine

COPY . /app
WORKDIR /app
RUN npm i

CMD ["npm", "start"]

