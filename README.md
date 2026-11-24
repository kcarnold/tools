# tools

Index of small single-page tools, deployed to https://tools.kenarnold.org via Cloudflare Workers (static assets).
Each tool lives in its own directory; add a link to it in `index.html`.

## Testing

```sh
npm install
npx playwright install chromium webkit   # once
npm test                                 # or: npm run test:chromium
npm start                                # http://localhost:4173/
```

A tool's tests go in `<tool>/tests/*.spec.mjs`. GitHub Actions runs them on every pull request and every push to `main`.
Nothing here needs a build step: what's in the repository is what gets deployed, minus what `.assetsignore` lists.
