FROM node:8.16-alpine

# Create app directory
WORKDIR /usr/src/app/

# Install app dependencies
COPY package.json yarn.lock tsconfig.json ./
RUN yarn --pure-lockfile && \ 
  yarn cache clean && \
  apk add --no-cache tini tzdata && \
  addgroup -S --gid 1001 telegram && \
  adduser -SDH -G telegram -u 1001 -s /bin/sh telegram

# Copy files
COPY src src

# Compile files
RUN yarn build

# Use telegram user
USER telegram

# Run Node app as child of tini
# Signal handling for PID1 https://github.com/krallin/tini
ENTRYPOINT ["/sbin/tini", "--"]

CMD [ "npm", "run", "--silent", "start" ]