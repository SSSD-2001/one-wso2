# One WSO2

**One** is WSO2's unified internal web experience: a single sign-in and a single app where an
employee's role loads the right *perspective* — Me, People Ops, Finance, Sales, Marketing Ops,
Security and Compliance, and more — instead of a separate app per team.

It is a React single-page app over independent backends, each joined by the same Asgardeo sign-in.

## Repository layout

| Path | What it is |
|---|---|
| [`webapp/`](webapp/) | The One WSO2 web app — React 19, TypeScript, Vite, Oxygen UI. Start with [`webapp/README.md`](webapp/README.md). |
| [`docs/One-Experience-Vision.md`](docs/One-Experience-Vision.md) | The product vision: the Perspectives model, information architecture, the assistant, and phasing. |
| [`docs/conventions.md`](docs/conventions.md) | Rules every feature follows: configuration, access gates, routing, data fetching, errors, time. |

## Quick start

```bash
cd webapp
npm install
cp public/config.js.example public/config.js   # then fill in the values
npm run dev                                    # http://localhost:3000
```

See [`webapp/README.md`](webapp/README.md) for configuration, scripts, and project structure.

## Contributing

1. Fork the repository and clone your fork.
2. Add the original repository as the `upstream` remote and fetch it. Branch off its latest `main` — never commit to `main` directly.
3. Follow [`docs/conventions.md`](docs/conventions.md).
4. Before opening a PR, run `npx tsc -b && npm test && npm run lint` in `webapp/`.
5. Open the PR against `main`. CodeRabbit reviews every PR automatically.

## License

Apache License 2.0 — see [`LICENSE`](LICENSE).
