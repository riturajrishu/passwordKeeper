# Production Deployment Guide

Follow these steps to deploy your application to a cloud provider (e.g., **Render**, **Railway**, or **DigitalOcean**).

## 1. Cloud Database (MongoDB Atlas)
Since your local MongoDB won't be accessible from the cloud, you need a hosted database:
1. Create a free account at [MongoDB Atlas](https://www.mongodb.com/).
2. Create a new Cluster (Shared/Free).
3. Under **Network Access**, add `0.0.0.0/0` (Allow access from anywhere).
4. Under **Database Access**, create a user with a strong password.
5. In your cluster dashboard, click **Connect** -> **Drivers** -> **Node.js** to get your `MONGO_URI`.

## 2. Environment Variables (Configuration)
In your hosting provider's dashboard (Render/Railway), add the following environment variables:

| Key | Value |
| :--- | :--- |
| `NODE_ENV` | `production` |
| `MONGO_URI` | *Your MongoDB Atlas Connection String* |
| `JWT_SECRET` | *Generate a long random string (e.g., use a password generator)* |
| `CLIENT_URL` | *The URL given to you by your host (e.g., `https://myapp.onrender.com`)* |
| `VITE_API_URL` | *Same as CLIENT_URL (since we are using Unified hosting)* |

## 3. Deployment Configuration (Render Example)

If using **Render**:
1. Connect your GitHub repository.
2. Select **Web Service**.
3. **Build Command**: `npm install && npm run build --prefix client && npm install --prefix server`
4. **Start Command**: `node server/index.js`

> [!TIP]
> **Unified Hosting**: I have configured your server to serve the frontend automatically. This means the entire app runs on a single domain, which avoids "Cross-Site Cookie" issues and makes deployment much smoother.

## 4. Final Verification
Once deployed, verify:
- [ ] You can register a new account.
- [ ] Your passwords are encrypted and saved correctly.
- [ ] The "Breach Scanner" works on the live site.
- [ ] HTTPS is active (the address bar shows a lock icon).
