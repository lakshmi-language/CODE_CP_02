# PulseSocial - Mini Social Media Platform

A modern, self-contained mini social media web platform featuring real-time feed updates, posts with image/hashtag support, likes, reposts, comments, user profile management, user following, direct messaging, real-time search, trending topics, activity notifications, and dark/light mode UI themes.

---

## 🌟 Key Features

1. **Dynamic Feed Timeline**:
   - **For You**: Algorithmic timeline of top posts.
   - **Following**: Filter posts from users you follow.
   - **Trending**: Discover top posts & trending topics.
   - **Bookmarks**: Access saved posts.

2. **Rich Content Posting**:
   - Multi-line text input with character limit counter (280 chars).
   - Automatic hashtag extraction (`#webdev`, `#ai2026`, etc.) and click-to-filter support.
   - Media attachments (preset sample picker or custom URL).

3. **Interactivity & Engagement**:
   - Like/Heart toggle with live counter updates.
   - Repost feature with live counter updates.
   - Comments section for post discussion threads.
   - Bookmarking posts to read later.
   - Author post deletion control.

4. **User Profiles & Switcher**:
   - Multiple pre-seeded profiles (@alex_dev, @sarah_design, @tech_insider, @creative_mind).
   - Interactive profile view with custom cover banner, bio, stats (following/followers/posts).
   - Follow/Unfollow user toggle.
   - Instant account switching & custom user profile registration.

5. **Direct Messaging & Notifications**:
   - Direct messaging (DM) chat interface between users.
   - Activity notifications feed (likes, comments, reposts, followers) with unread counter badges.

6. **Modern Design**:
   - Dark Mode / Light Mode toggle.
   - Responsive 3-column glassmorphism layout.

---

## 🚀 How to Run

No external package installation (`npm` or `pip`) is required. PulseSocial runs directly on Python 3 standard library:

1. Open your terminal in this directory:
   ```bash
   python app.py
   ```
2. Open your browser and navigate to:
   ```
   http://localhost:8000
   ```

---

## 📁 File Structure

```
mini-social-media/
├── app.py           # Backend REST API server & static file host (Python http.server)
├── db.py            # SQLite database schema initialization & seed data script
├── database.db      # Generated SQLite database file
├── README.md        # Documentation
└── static/
    ├── index.html   # Main HTML5 application shell
    ├── styles.css   # Modern CSS stylesheet (glassmorphism, CSS variables, dark/light theme)
    └── app.js       # Client-side SPA JavaScript logic (state manager, API integrations, DOM renderer)
```