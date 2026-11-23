# Webhook Widget starter for Cloudflare Workers

A [Webhook Widget](https://webhookwidget.com) endpoint that you can deploy in one click. It is
a Worker that returns a widget to the app and refuses a request that does not have the token.
The widget greets you, shows how much of the day has passed, and lists what your phone sent
with the request. Replace that with your own data.

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/smoothfrog/webhookwidget/tree/main/templates/starter)

## 1. Deploy it

Press the button. Cloudflare copies this template into a repository of your own, enables its
`*.workers.dev` URL, and pre-fills one secret, `WIDGET_TOKEN` — the **Bearer token** the app sends
with every request.

- Leave `WIDGET_TOKEN` as **`foobar`** to deploy and try it right away.
- Before showing private data, replace it with a long random string and treat it like a password:
  in the Cloudflare dashboard under **Worker → Settings → Variables and Secrets → Edit secret
  `WIDGET_TOKEN`**, or with `npx wrangler secret put WIDGET_TOKEN`.

Opening your deployed `https://my-widget.<your-subdomain>.workers.dev/` URL in a browser also
shows these setup steps (including the default token if you haven't changed it yet).

Or start from the command line instead:

```sh
npm create cloudflare@latest my-widget -- --template=smoothfrog/webhookwidget/templates/starter
cd my-widget
npx wrangler secret put WIDGET_TOKEN
npx wrangler deploy
```

## 2. Put it on your phone

Install [Webhook Widget](https://webhookwidget.com) on your iPhone first. The app needs the
Worker's address and **Bearer token** authentication (`WIDGET_TOKEN`, which defaults to `foobar`).

**In the app:** tap **Add Hook**, paste `https://my-widget.<your-subdomain>.workers.dev/`, set
**Authentication** to **Bearer token**, and enter your `WIDGET_TOKEN` (`foobar` by default). Or
open your `*.workers.dev` URL on your iPhone and tap **Open in Webhook Widget** while using the
default token.

**Or scan a QR code from your terminal** (reads the token from an environment variable so it stays
out of your shell history):

```sh
read -rs WIDGET_TOKEN && export WIDGET_TOKEN    # paste the token (or foobar), then press return
npx webhookwidget qr --name "My widget" --url https://my-widget.<your-subdomain>.workers.dev/ \
  --auth bearer --secret-env WIDGET_TOKEN
```

The code opens the app's hook editor with everything filled in. Tap Save, then add a Webhook
widget to your Home Screen. The QR code contains the token, so don't share a screenshot of it.

## 3. Make it yours

`payload()` in [`src/index.ts`](src/index.ts) builds everything the widget shows. Fetch
your own data there (an API, a database, another Worker) and return it as a widget. The
`webhookwidget` package's types check the payload as you write it, and
[the schema](https://webhookwidget.com/docs/schema/) shows every node.

To see your changes without waiting for the phone:

```sh
cp .dev.vars.example .dev.vars    # then put your own token in it
npm run dev
npx webhookwidget preview http://localhost:8787/ --family small --auth bearer --secret-env WIDGET_TOKEN --open
```

The last command opens the playground, which draws the widget with the same engine as the app.
Then run `npm run deploy`. The widget shows the change at its next refresh.

If you use an agent, give it [webhookwidget.com/llms.txt](https://webhookwidget.com/llms.txt)
and this README. The agent can check its work against the render from `preview --headless`.

## What's in it

| File | What it does |
| --- | --- |
| `src/index.ts` | Checks the token, reads the widget's size and the phone's time zone, and returns a payload for each size: small, medium, large and the three Lock Screen slots. |
| `wrangler.jsonc` | The Worker's name and settings. Rename `my-widget` to change its address. |
| `.dev.vars.example` | Default token (`foobar`) for local development. Change `WIDGET_TOKEN` before serving private data. |
