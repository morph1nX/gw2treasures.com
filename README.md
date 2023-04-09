> ⚠️ You are viewing the `next` branch of gw2treasures.com. Checkout the [legacy branch](https://github.com/GW2Treasures/gw2treasures.com/tree/legacy) for the legacy php application still running at [gw2treasures.com](https://gw2treasures.com).

# gw2treasures.com

**[gw2treasures.com](https://gw2treasures.com)** is a Guild Wars 2 database powered by the official API.

You can create a new issue to report a bug or request a new feature.

## Contributing

TODO

1. Install dependencies by running `npm i` in the root directory. This will install dependencies for all apps and packages.
2. Start the database in docker using `docker compose up -d next-db`.
3. Generate prisma by running `npm run prisma -w next`
4. Run `npm run dev`.
5. Visit http://localhost:3000/.

### Import legacy database

```sh
docker compose -f docker-compose.yml -f docker-compose.importer.yml up next-importer
```


## License
**gw2treasures.com** is licensed under the [MIT License](LICENSE).
