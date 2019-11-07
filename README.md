# dFusion Telegram Bots

## Setup environment variables

Create a `.env` file using [.env.example](.env.example) as a template.

You'll need to setup the Telegram token and the channel in the `.env` file or as environment variables when you run the process.

## Run in develop

> First setup the environment variables

```bash
# Install dependencies
yarn install

# Run
yarn dev
```

## Run with docker

> First setup the environment variables

First setup the environment variables using [.env.example](.env.example) as a template.

Then run docker compose:

```bash
docker-compose up
```

## Run in Production

> First setup the environment variables

First setup the environment variables using [.env.example](.env.example) as a template.

```bash
# Install dependencies
yarn install

# Build project
yarn build

# Run
yarn start
```
