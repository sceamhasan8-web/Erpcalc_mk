Theme and Logo instructions

1) Place your logo files

- Put the provided logo image (PNG) at: `public/erpcalc-logo.png`
- For mobile APK icons, add appropriately sized icons to `public/` (e.g. `icon-192.png`, `icon-512.png`).

2) How the app uses the logo

- The web layout references `/erpcalc-logo.png` in `src/components/Sidebar.tsx` and `src/components/Topbar.tsx`.

3) Building an APK (suggested)

- Use a wrapper like Capacitor or Expo to build an Android APK from the Next.js app (you'll need to export a static build or host it and wrap a webview).
- Example quick steps with Capacitor:

```bash
# build static export
npm run build
npm run export

# follow Capacitor docs to create Android project and copy the `out/` or hosted URL into the web assets
```

4) Theme

- Global theme variables are in `src/app/globals.css` under `:root` (primary blue, accent, card background).
- Adjust colors there to fine-tune the look.
