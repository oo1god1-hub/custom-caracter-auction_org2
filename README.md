# Custom Character Auction — V2

A real-time multiplayer character auction built with Node.js, Express and Socket.IO. Supports up to 3 players per room.

## V2 features
- Game password required on each fresh page load. The password is checked server-side and is never stored in the browser; the browser keeps only an in-memory access token.
- Separate server-side admin login.
- 15,000 coins per player.
- Default character roster and tier starting bids: SSS 1,000; SS 800; S 500; A 300; B 100.
- 16 default characters, including Neha (A tier).
- Quick bid with a player-controlled increment (default +50); manual bids remain available.
- Every accepted bid adds 5 seconds to the current countdown.
- Side-by-side team panels with character thumbnails, tiers and remaining budgets. Team power is withheld until the auction ends.
- Host-only pause/resume.
- End-of-game results, team power comparison, spending, remaining budget and auction history.
- Admin panel to upload/replace default character images, add custom characters and remove custom characters. Default characters cannot be deleted.
- Character images upload to Cloudinary as authenticated assets.
- **Surprise Mode:** the host can enable it in the lobby. The server randomly selects up to 8 characters from the room's roster at auction start. The selected roster is hidden in the lobby and characters are revealed one at a time during the auction. Standard Mode continues to show the roster in the lobby.
- **High-resolution image uploads:** the app accepts PNG, JPG/JPEG, WEBP and GIF images up to **25 MiB (26,214,400 bytes)** per image. The app does not resize or downsample images before sending them to Cloudinary.

## Local setup
1. Install Node.js 18 or newer.
2. Run `npm install`.
3. Set the environment variables below.
4. Run `npm start` and open `http://localhost:3000`.

## Required environment variables
Set these in your hosting provider's environment-variable settings. Do not put real passwords or API secrets in this README, source code, or a public repository.

```text
GAME_PASSWORD=<set-a-strong-game-password>
ADMIN_PASSWORD=<set-a-strong-admin-password>
CLOUDINARY_CLOUD_NAME=<your-cloud-name>
CLOUDINARY_API_KEY=<your-api-key>
CLOUDINARY_API_SECRET=<your-api-secret>
DATA_DIR=/var/data
```

Both game and admin passwords must be configured in the hosting environment. There is no hardcoded game-password fallback. The admin panel remains unavailable until `ADMIN_PASSWORD` is set.

## Render deployment and persistence
- Create a Node web service from this project ZIP/repository.
- Build command: `npm install`
- Start command: `npm start`
- Add all environment variables above in Render.
- Attach a Render Persistent Disk and mount it at `/var/data`; set `DATA_DIR=/var/data`. This stores custom-character roster metadata across restarts/deploys. Without a persistent disk, locally stored metadata may be lost when the instance is replaced.
- Cloudinary stores image assets separately. Configure all three Cloudinary variables before using photo uploads.

## Image upload limits and Cloudinary
- Browser-side and server-side upload limit: **25 MiB per image**. The server uses Multer's file-size limit and rejects unsupported MIME types.
- Cloudinary upload options restrict accepted formats to JPG/JPEG, PNG, WEBP and GIF. Uploads preserve the original image dimensions; no application-side resizing is applied, so high-resolution images can be uploaded within the size limit.
- Cloudinary's own maximum image size and maximum pixel/dimension limits depend on the account/product environment. The Cloudinary API has a general 100 MB per-request ceiling, but the account's configured maximum may be lower. The app's 25 MiB limit is intentionally below that general API ceiling.
- **Important:** the app cannot raise Cloudinary's account-level quota/limits from code. Check the Cloudinary Console's Account/Usage Limits for `image_max_size_bytes` and image pixel limits. If an image exceeds your account's Cloudinary limit, Cloudinary will reject it even though it is below the app's 25 MiB limit. Upgrade/change the account limit in Cloudinary if needed.

## Image privacy note
Images are uploaded as Cloudinary `authenticated` assets and delivered using signed URLs. Signed URLs are access credentials while valid: anyone who obtains a signed URL may be able to view that image. This reduces public discoverability but cannot prevent screenshots, copying, or sharing by an authorized viewer.

## Operational notes
- Rooms, player connections, bids and active auction state are held in server memory. A server restart ends active rooms; durable reconnection/recovery after a restart is not included in this V2 scope.
- Internet reconnection/rejoining after disconnect is not included in this V2 scope.
- Custom character editing (name, tier, price and power) is not included in this V2 scope; custom characters can currently be added or removed.
- Pause/resume is available to the room host during an active auction.
- Admin additions are available in rooms created after the character is added; an already-running room uses the roster snapshot it started with.
- Game/admin access tokens are in-memory and are invalidated by a server restart. A page refresh requires entering the game password again.
