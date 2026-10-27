# Webhook Widget starter for Cloudflare Workers

A [Webhook Widget](https://webhookwidget.com) endpoint you can deploy in one click: a Worker
that answers the app with a widget, and nobody else. It greets you, shows how far through the
day you are, and lists what your phone sent with the request. Replace that with your own data.

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/smoothfrog/webhookwidget/tree/main/templates/starter)

## 1. Deploy it

Press the button. Cloudflare copies this template into a repository of your own, builds it,
and asks for one secret, `WIDGET_TOKEN`. Make it long and random, and keep a copy:

```sh
openssl rand -hex 24
```

Or start from the command line instead:

```sh
npm create cloudflare@latest my-widget -- --template=smoothfrog/webhookwidget/templates/starter
cd my-widget
npx wrangler secret put WIDGET_TOKEN
npx wrangler deploy
```

## 2. Put it on your phone

The app needs the Worker's address and the token. Make a QR code with both and scan it with
the iPhone camera. The token is read from an environment variable, so it stays out of your
shell history:

```sh
read -rs WIDGET_TOKEN && export WIDGET_TOKEN    # paste the token, then press return
npx webhookwidget qr --name "My widget" --url https://my-widget.<your-subdomain>.workers.dev/ \
  --auth bearer --secret-env WIDGET_TOKEN
```

The code opens the app's hook editor with everything filled in. Tap Save, then add a Webhook
widget to your Home Screen. The QR code contains the token, so don't share a screenshot of it.

## 3. Make it yours

Everything the widget shows is built in `payload()` in [`src/index.ts`](src/index.ts). Fetch
your own data there (an API, a database, another Worker) and return it as a widget. The
`webhookwidget` package's types check the payload as you write it, and
[the schema](https://webhookwidget.com/docs/schema/) shows every node.

To see your changes without waiting for the phone:

```sh
cp .dev.vars.example .dev.vars    # then put your own token in it
npm run dev
npx webhookwidget preview http://localhost:8787/ --family small --auth bearer --secret-env WIDGET_TOKEN --open
```

That opens the playground, which draws the widget with the same engine as the app. Then
`npm run deploy`, and the phone picks it up at its next refresh.

Using an agent? Point it at [webhookwidget.com/llms.txt](https://webhookwidget.com/llms.txt)
and this README. `preview --headless` gives it a render to check its own work against.

## What's in it

| File | What it does |
| --- | --- |
| `src/index.ts` | Checks the token, reads the widget's size and the phone's time zone, and returns a payload for each size: small, medium, large and the three Lock Screen slots. |
| `wrangler.jsonc` | The Worker's name and settings. Rename `my-widget` to change its address. |
| `.dev.vars.example` | The token, for local development. The Worker refuses to run with its placeholder. |
