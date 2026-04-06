import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import mongoose from "mongoose";
import dotenv from "dotenv";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { OAuth2Client } from "google-auth-library";
import axios from "axios";
import Groq from "groq-sdk";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const JWT_SECRET = process.env.JWT_SECRET || "vibe-pulse-secret-key";

// --- MongoDB Connection ---
const MONGODB_URI = process.env.MONGODB_URI;

if (MONGODB_URI) {
  mongoose.connect(MONGODB_URI, { dbName: 'vibe-pulse' })
    .then(() => console.log("Connected to MongoDB Atlas (vibe-pulse database)"))
    .catch(err => console.error("MongoDB connection error:", err));
} else {
  console.warn("MONGODB_URI not found in environment variables. Running in demo mode.");
}

// --- Schemas ---
const UserSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String },
  name: { type: String },
  googleId: { type: String },
  avatar: { type: String },
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
  createdAt: { type: Date, default: Date.now }
});

const PostSchema = new mongoose.Schema({
  content: { type: String, required: true },
  platforms: [{ type: String, enum: ['linkedin', 'x', 'facebook'] }],
  status: { type: String, enum: ['draft', 'scheduled', 'published', 'failed'], default: 'draft' },
  scheduledAt: Date,
  impressions: { type: Number, default: 0 },
  engagements: { type: Number, default: 0 },
  clicks: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
});

const SocialAccountSchema = new mongoose.Schema({
  platform: { type: String, required: true },
  username: String,
  connected: { type: Boolean, default: false },
  accessToken: String,
  refreshToken: String,
  expiresAt: Date,
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
});

const User = mongoose.model('User', UserSchema);
const Post = mongoose.model('Post', PostSchema);
const SocialAccount = mongoose.model('SocialAccount', SocialAccountSchema);

// --- Middleware ---
const authenticateToken = (req: any, res: any, next: any) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.sendStatus(401);

  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

const authenticateAdmin = async (req: any, res: any, next: any) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ error: "Admin access required" });
    }
    next();
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
};

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", message: "Vibe Pulse Suite API is running" });
  });

  // Auth Routes
  app.post("/api/auth/register", async (req, res) => {
    try {
      const { email, password, name } = req.body;
      const existingUser = await User.findOne({ email });
      if (existingUser) return res.status(400).json({ error: "User already exists" });

      const userCount = await User.countDocuments();
      const role = userCount === 0 ? 'admin' : 'user'; // First user is admin

      const hashedPassword = await bcrypt.hash(password, 10);
      const user = new User({ email, password: hashedPassword, name, role });
      await user.save();
      const token = jwt.sign({ id: user._id, email: user.email, role: user.role }, JWT_SECRET);
      res.json({ token, user: { id: user._id, email: user.email, name: user.name, role: user.role } });
    } catch (error) {
      res.status(500).json({ error: "Registration failed" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body;
      const user = await User.findOne({ email });
      if (!user || !user.password) return res.status(400).json({ error: "Invalid credentials" });
      
      const validPassword = await bcrypt.compare(password, user.password);
      if (!validPassword) return res.status(400).json({ error: "Invalid credentials" });

      const token = jwt.sign({ id: user._id, email: user.email, role: user.role }, JWT_SECRET);
      res.json({ token, user: { id: user._id, email: user.email, name: user.name, avatar: user.avatar, role: user.role } });
    } catch (error) {
      res.status(500).json({ error: "Login failed" });
    }
  });

  app.post("/api/auth/google", async (req, res) => {
    try {
      const { credential } = req.body;
      const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
      const ticket = await googleClient.verifyIdToken({
        idToken: credential,
        audience: process.env.GOOGLE_CLIENT_ID
      });
      const payload = ticket.getPayload();
      if (!payload) return res.status(400).json({ error: "Invalid Google token" });

      const { email, sub: googleId, name, picture: avatar } = payload;
      let user = await User.findOne({ email });

      if (!user) {
        user = new User({ email, googleId, name, avatar });
        await user.save();
      } else if (!user.googleId) {
        user.googleId = googleId;
        user.avatar = avatar;
        await user.save();
      }

      const token = jwt.sign({ id: user._id, email: user.email }, JWT_SECRET);
      res.json({ token, user: { id: user._id, email: user.email, name: user.name, avatar: user.avatar } });
    } catch (error) {
      console.error("Google Auth Error:", error);
      res.status(500).json({ error: "Google auth failed" });
    }
  });

  app.get("/api/auth/me", authenticateToken, async (req: any, res) => {
    try {
      const user = await User.findById(req.user.id);
      if (!user) return res.status(404).json({ error: "User not found" });
      res.json({ user: { id: user._id, email: user.email, name: user.name, avatar: user.avatar, role: user.role } });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch user" });
    }
  });

  // AI Generation with Groq
  app.post("/api/ai/generate", authenticateToken, async (req, res) => {
    try {
      const { prompt } = req.body;
      const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
      
      const completion = await groq.chat.completions.create({
        messages: [
          { role: "system", content: "You are a social media expert. Write engaging, professional, and concise social media posts." },
          { role: "user", content: prompt }
        ],
        model: "llama3-8b-8192",
      });

      res.json({ text: completion.choices[0]?.message?.content || "" });
    } catch (error) {
      console.error("Groq AI Error:", error);
      res.status(500).json({ error: "AI generation failed" });
    }
  });

  // Dashboard Stats
  app.get("/api/dashboard/stats", authenticateToken, async (req: any, res) => {
    try {
      const posts = await Post.find({ userId: req.user.id });
      const totalPosts = posts.length;
      const totalImpressions = posts.reduce((sum, p) => sum + p.impressions, 0);
      const totalEngagements = posts.reduce((sum, p) => sum + p.engagements, 0);
      const avgEngagementRate = totalImpressions > 0 ? (totalEngagements / totalImpressions) * 100 : 0;

      res.json({
        totalPosts,
        totalImpressions,
        totalEngagements,
        avgEngagementRate: avgEngagementRate.toFixed(1) + '%'
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch dashboard stats" });
    }
  });

  // Admin Routes
  app.get("/api/admin/stats", authenticateToken, authenticateAdmin, async (req, res) => {
    try {
      const totalUsers = await User.countDocuments();
      const totalPosts = await Post.countDocuments();
      const connectedAccounts = await SocialAccount.countDocuments({ connected: true });
      
      // Get some growth data (mocked for now but based on real counts)
      res.json({
        totalUsers,
        totalPosts,
        connectedAccounts,
        activeUsers: await User.countDocuments({ createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } })
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch admin stats" });
    }
  });

  app.get("/api/admin/users", authenticateToken, authenticateAdmin, async (req, res) => {
    try {
      const users = await User.find({}, '-password').sort({ createdAt: -1 });
      res.json(users);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  // Real Social Media Connections
  app.get("/api/socials", authenticateToken, async (req: any, res) => {
    try {
      if (!MONGODB_URI) {
        return res.json([
          { id: 'linkedin', name: 'LinkedIn', connected: true, username: 'VibePulse_Admin' },
          { id: 'x', name: 'X (Twitter)', connected: false },
          { id: 'facebook', name: 'Facebook', connected: true, username: 'VibePulse Official' },
        ]);
      }
      const accounts = await SocialAccount.find({ userId: req.user.id });
      const platforms = ['linkedin', 'x', 'facebook'];
      const result = platforms.map(p => {
        const found = accounts.find(a => a.platform === p);
        return {
          id: p,
          name: p === 'x' ? 'X (Twitter)' : p.charAt(0).toUpperCase() + p.slice(1),
          connected: found ? found.connected : false,
          username: found ? found.username : null
        };
      });
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch social accounts" });
    }
  });

  app.post("/api/socials/connect", authenticateToken, async (req: any, res) => {
    try {
      const { platform, username } = req.body;
      if (!MONGODB_URI) return res.json({ success: true });

      await SocialAccount.findOneAndUpdate(
        { platform, userId: req.user.id },
        { platform, username, connected: true, userId: req.user.id },
        { upsert: true }
      );
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to connect account" });
    }
  });

  // LinkedIn OAuth Routes
  app.get("/api/auth/linkedin/url", authenticateToken, (req: any, res) => {
    const redirectUri = `${process.env.APP_URL}/api/auth/linkedin/callback`;
    const state = jwt.sign({ userId: req.user.id }, JWT_SECRET, { expiresIn: '10m' });
    
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: process.env.LINKEDIN_CLIENT_ID || '',
      redirect_uri: redirectUri,
      state: state,
      scope: 'r_liteprofile r_emailaddress w_member_social',
    });

    res.json({ url: `https://www.linkedin.com/oauth/v2/authorization?${params.toString()}` });
  });

  app.get(["/api/auth/linkedin/callback", "/api/auth/linkedin/callback/"], async (req, res) => {
    const { code, state } = req.query;

    try {
      if (!code || !state) throw new Error("Missing code or state");

      // Verify state
      const decoded: any = jwt.verify(state as string, JWT_SECRET);
      const userId = decoded.userId;

      const redirectUri = `${process.env.APP_URL}/api/auth/linkedin/callback`;
      
      // Exchange code for token
      const tokenResponse = await axios.post('https://www.linkedin.com/oauth/v2/accessToken', 
        new URLSearchParams({
          grant_type: 'authorization_code',
          code: code as string,
          redirect_uri: redirectUri,
          client_id: process.env.LINKEDIN_CLIENT_ID || '',
          client_secret: process.env.LINKEDIN_CLIENT_SECRET || '',
        }).toString(),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
      );

      const { access_token, expires_in, refresh_token } = tokenResponse.data;

      // Get user profile
      const profileResponse = await axios.get('https://api.linkedin.com/v2/me', {
        headers: { 'Authorization': `Bearer ${access_token}` }
      });

      const username = `${profileResponse.data.localizedFirstName} ${profileResponse.data.localizedLastName}`;

      // Save to database
      await SocialAccount.findOneAndUpdate(
        { platform: 'linkedin', userId: userId },
        { 
          platform: 'linkedin', 
          username, 
          connected: true, 
          accessToken: access_token,
          refreshToken: refresh_token,
          expiresAt: new Date(Date.now() + expires_in * 1000),
          userId: userId 
        },
        { upsert: true }
      );

      res.send(`
        <html>
          <body>
            <script>
              if (window.opener) {
                window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS', platform: 'linkedin' }, '*');
                window.close();
              } else {
                window.location.href = '/';
              }
            </script>
            <p>Authentication successful. This window should close automatically.</p>
          </body>
        </html>
      `);
    } catch (error) {
      console.error("LinkedIn OAuth Error:", error);
      res.status(500).send("Authentication failed. Please try again.");
    }
  });

  // X (Twitter) OAuth Routes
  app.get("/api/auth/x/url", authenticateToken, (req: any, res) => {
    const redirectUri = `${process.env.APP_URL}/api/auth/x/callback`;
    const state = jwt.sign({ userId: req.user.id }, JWT_SECRET, { expiresIn: '10m' });
    
    // For X OAuth 2.0 PKCE is usually required, but for simplicity we'll use a basic flow if supported or mock the URL construction
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: process.env.X_CLIENT_ID || '',
      redirect_uri: redirectUri,
      state: state,
      scope: 'tweet.read users.read tweet.write offline.access',
      code_challenge: 'challenge', // In a real app, generate this
      code_challenge_method: 'plain'
    });

    res.json({ url: `https://twitter.com/i/oauth2/authorize?${params.toString()}` });
  });

  app.get(["/api/auth/x/callback", "/api/auth/x/callback/"], async (req, res) => {
    const { code, state } = req.query;
    try {
      if (!code || !state) throw new Error("Missing code or state");
      const decoded: any = jwt.verify(state as string, JWT_SECRET);
      const userId = decoded.userId;
      const redirectUri = `${process.env.APP_URL}/api/auth/x/callback`;

      const tokenResponse = await axios.post('https://api.twitter.com/2/oauth2/token', 
        new URLSearchParams({
          grant_type: 'authorization_code',
          code: code as string,
          redirect_uri: redirectUri,
          client_id: process.env.X_CLIENT_ID || '',
          code_verifier: 'challenge',
        }).toString(),
        { 
          headers: { 
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': `Basic ${Buffer.from(`${process.env.X_CLIENT_ID}:${process.env.X_CLIENT_SECRET}`).toString('base64')}`
          } 
        }
      );

      const { access_token, expires_in, refresh_token } = tokenResponse.data;

      // Get user profile
      const profileResponse = await axios.get('https://api.twitter.com/2/users/me', {
        headers: { 'Authorization': `Bearer ${access_token}` }
      });

      const username = profileResponse.data.data.username;

      await SocialAccount.findOneAndUpdate(
        { platform: 'x', userId: userId },
        { 
          platform: 'x', 
          username, 
          connected: true, 
          accessToken: access_token,
          refreshToken: refresh_token,
          expiresAt: new Date(Date.now() + expires_in * 1000),
          userId: userId 
        },
        { upsert: true }
      );

      res.send(`<html><body><script>if(window.opener){window.opener.postMessage({type:'OAUTH_AUTH_SUCCESS',platform:'x'},'*');window.close();}else{window.location.href='/';}</script></body></html>`);
    } catch (error) {
      console.error("X OAuth Error:", error);
      res.status(500).send("Authentication failed.");
    }
  });

  // Facebook OAuth Routes
  app.get("/api/auth/facebook/url", authenticateToken, (req: any, res) => {
    const redirectUri = `${process.env.APP_URL}/api/auth/facebook/callback`;
    const state = jwt.sign({ userId: req.user.id }, JWT_SECRET, { expiresIn: '10m' });
    
    const params = new URLSearchParams({
      client_id: process.env.FACEBOOK_APP_ID || '',
      redirect_uri: redirectUri,
      state: state,
      scope: 'public_profile,email,pages_manage_posts,pages_read_engagement',
    });

    res.json({ url: `https://www.facebook.com/v12.0/dialog/oauth?${params.toString()}` });
  });

  app.get(["/api/auth/facebook/callback", "/api/auth/facebook/callback/"], async (req, res) => {
    const { code, state } = req.query;
    try {
      if (!code || !state) throw new Error("Missing code or state");
      const decoded: any = jwt.verify(state as string, JWT_SECRET);
      const userId = decoded.userId;
      const redirectUri = `${process.env.APP_URL}/api/auth/facebook/callback`;

      const tokenResponse = await axios.get('https://graph.facebook.com/v12.0/oauth/access_token', {
        params: {
          client_id: process.env.FACEBOOK_APP_ID,
          client_secret: process.env.FACEBOOK_APP_SECRET,
          redirect_uri: redirectUri,
          code: code,
        }
      });

      const { access_token, expires_in } = tokenResponse.data;

      // Get user profile
      const profileResponse = await axios.get('https://graph.facebook.com/me', {
        params: { access_token, fields: 'name' }
      });

      const username = profileResponse.data.name;

      await SocialAccount.findOneAndUpdate(
        { platform: 'facebook', userId: userId },
        { 
          platform: 'facebook', 
          username, 
          connected: true, 
          accessToken: access_token,
          expiresAt: new Date(Date.now() + (expires_in || 3600) * 1000),
          userId: userId 
        },
        { upsert: true }
      );

      res.send(`<html><body><script>if(window.opener){window.opener.postMessage({type:'OAUTH_AUTH_SUCCESS',platform:'facebook'},'*');window.close();}else{window.location.href='/';}</script></body></html>`);
    } catch (error) {
      console.error("Facebook OAuth Error:", error);
      res.status(500).send("Authentication failed.");
    }
  });

  // Real Posts
  app.get("/api/posts", authenticateToken, async (req: any, res) => {
    try {
      if (!MONGODB_URI) return res.json([]);
      const posts = await Post.find({ userId: req.user.id }).sort({ createdAt: -1 });
      res.json(posts);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch posts" });
    }
  });

  // Post to Social Media Helper
  const postToSocialMedia = async (post: any) => {
    console.log(`[LookoutPost] Publishing post to: ${post.platforms.join(', ')}`);
    // In a real implementation, you would use the stored access tokens for each platform
    // to call their respective APIs (e.g., LinkedIn UGC API, X v2 API, Facebook Graph API).
    // Example for LinkedIn:
    // const account = await SocialAccount.findOne({ userId: post.userId, platform: 'linkedin' });
    // if (account?.accessToken) {
    //   await axios.post('https://api.linkedin.com/v2/ugcPosts', { ... }, { headers: { Authorization: `Bearer ${account.accessToken}` } });
    // }
  };

  app.post("/api/posts", authenticateToken, async (req: any, res) => {
    try {
      const { content, platforms, scheduledAt } = req.body;
      
      if (!MONGODB_URI) {
        return res.json({ status: scheduledAt ? 'scheduled' : 'published', message: 'Demo mode: Post processed' });
      }

      const newPost = new Post({
        content,
        platforms,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
        status: scheduledAt ? 'scheduled' : 'published',
        userId: req.user.id
      });

      await newPost.save();

      if (newPost.status === 'published') {
        await postToSocialMedia(newPost);
      }

      res.json({ status: newPost.status, message: 'Post saved successfully', post: newPost });
    } catch (error) {
      res.status(500).json({ error: "Failed to create post" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
