# Webhook Widget

[Webhook Widget](https://webhookwidget.com) turns any JSON endpoint into an iPhone widget. Your
server returns the whole layout, and the app draws it on the Home Screen and Lock Screen: no
Xcode, no developer account, no account at all.

This repository is the developer side:

| | |
| --- | --- |
| [`packages/webhookwidget`](packages/webhookwidget) | `npm i webhookwidget`: types for the payload, and `npx webhookwidget` for setup QR codes, links and previews. |
| [`templates/starter`](templates/starter) | A Cloudflare Worker that serves a widget, protected by a token. Deploys in one click. |

## From nothing to a widget

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/smoothfrog/webhookwidget/tree/main/templates/starter)

1. Deploy the starter, and choose a token when Cloudflare asks for `WIDGET_TOKEN`.
2. Make a QR code for it and scan it with the iPhone camera:

   ```sh
   read -rs WIDGET_TOKEN && export WIDGET_TOKEN
   npx webhookwidget qr --name "My widget" --url https://my-widget.<your-subdomain>.workers.dev/ \
     --auth bearer --secret-env WIDGET_TOKEN
   ```

3. Tap Save in the app, and add a Webhook widget to your Home Screen.

Then make it show your own data: [the starter's README](templates/starter#3-make-it-yours).

## Docs

- [Quickstart](https://webhookwidget.com/docs/quickstart/) and [the node reference](https://webhookwidget.com/docs/schema/)
- [The playground](https://webhookwidget.com/playground/), which draws a payload with the app's engine
- [llms.txt](https://webhookwidget.com/llms.txt), for coding agents
- [Worked examples](https://webhookwidget.com/examples/), each served live at `webhookwidget.com/demo/<id>`

## Questions and bugs

Open an [issue](https://github.com/smoothfrog/webhookwidget/issues), or email
[support@webhookwidget.com](mailto:support@webhookwidget.com).

MIT licensed. Webhook Widget is made by [Smooth Frog Ltd](https://smoothfrog.com).
