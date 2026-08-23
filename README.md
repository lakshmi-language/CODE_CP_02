# MiniSocial — Mini Social Media Platform (Django)

A mini social media app built with **Django** (backend), **HTML/CSS/JavaScript**
(frontend), and **SQLite** (database). Includes user profiles, posts &
comments, and a like/follow system.

## Features

- **User profiles**: bio, avatar, follower/following/post counts, edit page
- **Posts & comments**: create posts (with optional image), comment on any post
- **Like/follow system**: like/unlike posts, follow/unfollow users
- **Feed**: shows posts from people you follow (plus your own)
- **Explore**: browse all posts to discover new people
- User registration and login/logout (Django's built-in auth)
- Admin panel for managing users, posts, comments, likes, and follows

## Project structure

```
social_media_app/
├── manage.py
├── requirements.txt
├── socialmedia/          # project settings, root urls
├── social/                # the app: models, views, templates, static files
│   ├── models.py          # Profile, Post, Comment, Like, Follow
│   ├── signals.py         # auto-creates a Profile when a User signs up
│   ├── views.py
│   ├── urls.py
│   ├── forms.py
│   ├── admin.py
│   ├── templatetags/      # custom "liked_by" filter
│   ├── templates/
│   └── static/social/{css,js}/
└── db.sqlite3              # created after migrations
```

## Setup

1. Create a virtual environment and install dependencies:

   ```bash
   python -m venv venv
   source venv/bin/activate      # on Windows: venv\Scripts\activate
   pip install -r requirements.txt
   ```

2. Run migrations to create the database tables:

   ```bash
   python manage.py makemigrations
   python manage.py migrate
   ```

3. Create an admin user (optional, for the /admin panel):

   ```bash
   python manage.py createsuperuser
   ```

4. (Optional) Seed sample users, posts, follows, likes, and comments:

   ```bash
   python manage.py seed_social
   ```

   This creates users `alice`, `bob`, and `carol`, all with password `password123`.

5. Run the development server:

   ```bash
   python manage.py runserver
   ```

6. Visit the site:

   - Feed: http://127.0.0.1:8000/ (requires login)
   - Explore: http://127.0.0.1:8000/explore/
   - Admin: http://127.0.0.1:8000/admin/
   - Register: http://127.0.0.1:8000/register/
   - Login: http://127.0.0.1:8000/accounts/login/

## Data model

- **Profile** — one-to-one with `User`; bio, avatar. Auto-created via a signal.
- **Post** — belongs to a `User`; text content + optional image.
- **Comment** — belongs to a `Post` and a `User`.
- **Like** — join table between `User` and `Post` (unique per user/post).
- **Follow** — join table between two `User`s (`follower` → `following`,
  unique per pair), used to build the feed.

## Notes

- `DEBUG = True` and `SECRET_KEY` in `socialmedia/settings.py` are fine for
  local development only — change both before deploying anywhere public.
- Uploading images (avatars/post photos) requires `Pillow` (already in
  requirements.txt).
