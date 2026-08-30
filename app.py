import http.server
import socketserver
import json
import urllib.parse
import os
import re
import datetime
import db

PORT = 8000
STATIC_DIR = os.path.join(os.path.dirname(__file__), "static")
UPLOADS_DIR = os.path.join(STATIC_DIR, "uploads")

os.makedirs(UPLOADS_DIR, exist_ok=True)

# Ensure DB is initialized
db.init_db()

class SocialAppRequestHandler(http.server.BaseHTTPRequestHandler):

    def _send_json(self, data, status=200):
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, X-Active-User")
        self.end_headers()
        self.wfile.write(json.dumps(data, default=str).encode("utf-8"))

    def _send_error(self, message, status=400):
        self._send_json({"error": message}, status=status)

    def _get_active_user_id(self):
        user_header = self.headers.get("X-Active-User")
        if user_header:
            try:
                return int(user_header)
            except ValueError:
                pass
        return 1  # Default to Alex Rivera

    def _read_body_json(self):
        content_length = int(self.headers.get("Content-Length", 0))
        if content_length == 0:
            return {}
        body = self.rfile.read(content_length).decode("utf-8")
        try:
            return json.loads(body)
        except json.JSONDecodeError:
            return {}

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, X-Active-User")
        self.end_headers()

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        query = urllib.parse.parse_qs(parsed.query)

        active_user_id = self._get_active_user_id()

        # API Routes
        if path == "/api/users":
            self._handle_get_users(active_user_id)
            return
        elif path.startswith("/api/users/"):
            user_id_str = path.replace("/api/users/", "")
            if user_id_str.isdigit():
                self._handle_get_user_profile(int(user_id_str), active_user_id)
                return
        elif path == "/api/posts":
            self._handle_get_posts(query, active_user_id)
            return
        elif path.startswith("/api/posts/") and path.endswith("/comments"):
            post_id_str = path.split("/")[3]
            if post_id_str.isdigit():
                self._handle_get_comments(int(post_id_str))
                return
        elif path == "/api/messages":
            contact_id = query.get("contact_id", [None])[0]
            if contact_id and contact_id.isdigit():
                self._handle_get_messages(active_user_id, int(contact_id))
            else:
                self._handle_get_message_contacts(active_user_id)
            return
        elif path == "/api/notifications":
            self._handle_get_notifications(active_user_id)
            return

        # Static File Serving
        self._serve_static(path)

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        active_user_id = self._get_active_user_id()
        data = self._read_body_json()

        if path == "/api/posts":
            self._handle_create_post(data, active_user_id)
        elif path == "/api/users":
            self._handle_create_user(data)
        elif path.startswith("/api/users/") and path.endswith("/follow"):
            user_id_str = path.split("/")[3]
            if user_id_str.isdigit():
                self._handle_toggle_follow(int(user_id_str), active_user_id)
        elif path.startswith("/api/posts/") and path.endswith("/like"):
            post_id_str = path.split("/")[3]
            if post_id_str.isdigit():
                self._handle_toggle_like(int(post_id_str), active_user_id)
        elif path.startswith("/api/posts/") and path.endswith("/repost"):
            post_id_str = path.split("/")[3]
            if post_id_str.isdigit():
                self._handle_toggle_repost(int(post_id_str), active_user_id)
        elif path.startswith("/api/posts/") and path.endswith("/bookmark"):
            post_id_str = path.split("/")[3]
            if post_id_str.isdigit():
                self._handle_toggle_bookmark(int(post_id_str), active_user_id)
        elif path.startswith("/api/posts/") and path.endswith("/comments"):
            post_id_str = path.split("/")[3]
            if post_id_str.isdigit():
                self._handle_create_comment(int(post_id_str), data, active_user_id)
        elif path == "/api/messages":
            self._handle_send_message(data, active_user_id)
        elif path == "/api/notifications/read":
            self._handle_read_notifications(active_user_id)
        else:
            self._send_error("Route not found", 404)

    def do_DELETE(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        active_user_id = self._get_active_user_id()

        if path.startswith("/api/posts/"):
            post_id_str = path.replace("/api/posts/", "")
            if post_id_str.isdigit():
                self._handle_delete_post(int(post_id_str), active_user_id)
                return
        self._send_error("Route not found", 404)

    # --- HANDLERS ---

    def _handle_get_users(self, active_user_id):
        conn = db.get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM users ORDER BY id ASC")
        rows = cursor.fetchall()
        
        users = []
        for r in rows:
            u = dict(r)
            # check following status
            cursor.execute("SELECT 1 FROM follows WHERE follower_id = ? AND following_id = ?", (active_user_id, u["id"]))
            u["is_following"] = cursor.fetchone() is not None
            users.append(u)

        conn.close()
        self._send_json(users)

    def _handle_get_user_profile(self, target_user_id, active_user_id):
        conn = db.get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM users WHERE id = ?", (target_user_id,))
        user_row = cursor.fetchone()
        if not user_row:
            conn.close()
            self._send_error("User not found", 404)
            return

        user = dict(user_row)
        cursor.execute("SELECT COUNT(*) as cnt FROM follows WHERE follower_id = ?", (target_user_id,))
        user["following_count"] = cursor.fetchone()["cnt"]

        cursor.execute("SELECT COUNT(*) as cnt FROM follows WHERE following_id = ?", (target_user_id,))
        user["followers_count"] = cursor.fetchone()["cnt"]

        cursor.execute("SELECT COUNT(*) as cnt FROM posts WHERE user_id = ?", (target_user_id,))
        user["posts_count"] = cursor.fetchone()["cnt"]

        cursor.execute("SELECT 1 FROM follows WHERE follower_id = ? AND following_id = ?", (active_user_id, target_user_id))
        user["is_following"] = cursor.fetchone() is not None

        conn.close()
        self._send_json(user)

    def _handle_create_user(self, data):
        handle = data.get("handle", "").strip().lower()
        name = data.get("name", "").strip()
        bio = data.get("bio", "").strip()
        avatar = data.get("avatar", "").strip() or "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80"
        banner = "https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=800&auto=format&fit=crop&q=80"

        if not handle or not name:
            self._send_error("Handle and Name are required")
            return

        conn = db.get_connection()
        cursor = conn.cursor()
        try:
            now = datetime.datetime.now().isoformat()
            cursor.execute("""
                INSERT INTO users (handle, name, bio, avatar, banner, joined_at)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (handle, name, bio, avatar, banner, now))
            conn.commit()
            new_id = cursor.lastrowid
            conn.close()
            self._handle_get_user_profile(new_id, new_id)
        except Exception as e:
            conn.close()
            self._send_error("Username/handle already taken", 400)

    def _handle_get_posts(self, query, active_user_id):
        feed_type = query.get("feed", ["for-you"])[0]
        search_q = query.get("q", [""])[0].strip()
        hashtag_q = query.get("hashtag", [""])[0].strip()
        user_id_filter = query.get("user_id", [None])[0]

        conn = db.get_connection()
        cursor = conn.cursor()

        sql = """
            SELECT p.*, u.handle, u.name, u.avatar, u.bio
            FROM posts p
            JOIN users u ON p.user_id = u.id
        """
        params = []
        where_clauses = []

        if feed_type == "following":
            where_clauses.append("p.user_id IN (SELECT following_id FROM follows WHERE follower_id = ?)")
            params.append(active_user_id)
        elif feed_type == "saved":
            where_clauses.append("p.id IN (SELECT post_id FROM bookmarks WHERE user_id = ?)")
            params.append(active_user_id)
        elif user_id_filter and user_id_filter.isdigit():
            where_clauses.append("p.user_id = ?")
            params.append(int(user_id_filter))

        if search_q:
            where_clauses.append("(p.content LIKE ? OR u.name LIKE ? OR u.handle LIKE ?)")
            q_term = f"%{search_q}%"
            params.extend([q_term, q_term, q_term])

        if hashtag_q:
            where_clauses.append("p.hashtags LIKE ?")
            params.append(f"%{hashtag_q}%")

        if where_clauses:
            sql += " WHERE " + " AND ".join(where_clauses)

        sql += " ORDER BY p.created_at DESC"

        cursor.execute(sql, params)
        rows = cursor.fetchall()

        posts = []
        for r in rows:
            p = dict(r)
            pid = p["id"]

            # stats & states
            cursor.execute("SELECT COUNT(*) as cnt FROM likes WHERE post_id = ?", (pid,))
            p["likes_count"] = cursor.fetchone()["cnt"]

            cursor.execute("SELECT COUNT(*) as cnt FROM reposts WHERE post_id = ?", (pid,))
            p["reposts_count"] = cursor.fetchone()["cnt"]

            cursor.execute("SELECT COUNT(*) as cnt FROM comments WHERE post_id = ?", (pid,))
            p["comments_count"] = cursor.fetchone()["cnt"]

            cursor.execute("SELECT 1 FROM likes WHERE user_id = ? AND post_id = ?", (active_user_id, pid))
            p["is_liked"] = cursor.fetchone() is not None

            cursor.execute("SELECT 1 FROM reposts WHERE user_id = ? AND post_id = ?", (active_user_id, pid))
            p["is_reposted"] = cursor.fetchone() is not None

            cursor.execute("SELECT 1 FROM bookmarks WHERE user_id = ? AND post_id = ?", (active_user_id, pid))
            p["is_bookmarked"] = cursor.fetchone() is not None

            posts.append(p)

        conn.close()
        self._send_json(posts)

    def _handle_create_post(self, data, active_user_id):
        content = data.get("content", "").strip()
        image_url = data.get("image_url", "").strip() or None

        if not content and not image_url:
            self._send_error("Post content or image is required")
            return

        # Extract hashtags from content
        found_tags = re.findall(r"#\w+", content)
        hashtags_str = ",".join([tag.lower() for tag in found_tags]) if found_tags else None

        conn = db.get_connection()
        cursor = conn.cursor()
        now = datetime.datetime.now().isoformat()
        cursor.execute("""
            INSERT INTO posts (user_id, content, image_url, hashtags, created_at)
            VALUES (?, ?, ?, ?, ?)
        """, (active_user_id, content, image_url, hashtags_str, now))
        conn.commit()
        post_id = cursor.lastrowid
        conn.close()

        # Return created post object
        self._handle_get_posts({"q": [f"id:{post_id}"]}, active_user_id)

    def _handle_delete_post(self, post_id, active_user_id):
        conn = db.get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT user_id FROM posts WHERE id = ?", (post_id,))
        row = cursor.fetchone()
        if not row:
            conn.close()
            self._send_error("Post not found", 404)
            return

        if row["user_id"] != active_user_id:
            conn.close()
            self._send_error("Unauthorized to delete this post", 403)
            return

        cursor.execute("DELETE FROM posts WHERE id = ?", (post_id,))
        conn.commit()
        conn.close()
        self._send_json({"success": True, "message": "Post deleted successfully"})

    def _handle_toggle_like(self, post_id, active_user_id):
        conn = db.get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT 1 FROM likes WHERE user_id = ? AND post_id = ?", (active_user_id, post_id))
        is_liked = cursor.fetchone() is not None

        now = datetime.datetime.now().isoformat()
        if is_liked:
            cursor.execute("DELETE FROM likes WHERE user_id = ? AND post_id = ?", (active_user_id, post_id))
            liked = False
        else:
            cursor.execute("INSERT INTO likes (user_id, post_id, created_at) VALUES (?, ?, ?)", (active_user_id, post_id, now))
            liked = True

            # Notify post author
            cursor.execute("SELECT user_id FROM posts WHERE id = ?", (post_id,))
            prow = cursor.fetchone()
            if prow and prow["user_id"] != active_user_id:
                cursor.execute("""
                    INSERT INTO notifications (user_id, actor_id, type, target_id, is_read, created_at)
                    VALUES (?, ?, 'like', ?, 0, ?)
                """, (prow["user_id"], active_user_id, post_id, now))

        conn.commit()
        conn.close()
        self._send_json({"success": True, "liked": liked})

    def _handle_toggle_repost(self, post_id, active_user_id):
        conn = db.get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT 1 FROM reposts WHERE user_id = ? AND post_id = ?", (active_user_id, post_id))
        is_reposted = cursor.fetchone() is not None

        now = datetime.datetime.now().isoformat()
        if is_reposted:
            cursor.execute("DELETE FROM reposts WHERE user_id = ? AND post_id = ?", (active_user_id, post_id))
            reposted = False
        else:
            cursor.execute("INSERT INTO reposts (user_id, post_id, created_at) VALUES (?, ?, ?)", (active_user_id, post_id, now))
            reposted = True

            # Notify post author
            cursor.execute("SELECT user_id FROM posts WHERE id = ?", (post_id,))
            prow = cursor.fetchone()
            if prow and prow["user_id"] != active_user_id:
                cursor.execute("""
                    INSERT INTO notifications (user_id, actor_id, type, target_id, is_read, created_at)
                    VALUES (?, ?, 'repost', ?, 0, ?)
                """, (prow["user_id"], active_user_id, post_id, now))

        conn.commit()
        conn.close()
        self._send_json({"success": True, "reposted": reposted})

    def _handle_toggle_bookmark(self, post_id, active_user_id):
        conn = db.get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT 1 FROM bookmarks WHERE user_id = ? AND post_id = ?", (active_user_id, post_id))
        is_bookmarked = cursor.fetchone() is not None

        now = datetime.datetime.now().isoformat()
        if is_bookmarked:
            cursor.execute("DELETE FROM bookmarks WHERE user_id = ? AND post_id = ?", (active_user_id, post_id))
            bookmarked = False
        else:
            cursor.execute("INSERT INTO bookmarks (user_id, post_id, created_at) VALUES (?, ?, ?)", (active_user_id, post_id, now))
            bookmarked = True

        conn.commit()
        conn.close()
        self._send_json({"success": True, "bookmarked": bookmarked})

    def _handle_toggle_follow(self, target_user_id, active_user_id):
        if target_user_id == active_user_id:
            self._send_error("Cannot follow yourself", 400)
            return

        conn = db.get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT 1 FROM follows WHERE follower_id = ? AND following_id = ?", (active_user_id, target_user_id))
        is_following = cursor.fetchone() is not None

        now = datetime.datetime.now().isoformat()
        if is_following:
            cursor.execute("DELETE FROM follows WHERE follower_id = ? AND following_id = ?", (active_user_id, target_user_id))
            following = False
        else:
            cursor.execute("INSERT INTO follows (follower_id, following_id, created_at) VALUES (?, ?, ?)", (active_user_id, target_user_id, now))
            following = True

            cursor.execute("""
                INSERT INTO notifications (user_id, actor_id, type, target_id, is_read, created_at)
                VALUES (?, ?, 'follow', NULL, 0, ?)
            """, (target_user_id, active_user_id, now))

        conn.commit()
        conn.close()
        self._send_json({"success": True, "following": following})

    def _handle_get_comments(self, post_id):
        conn = db.get_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT c.*, u.handle, u.name, u.avatar
            FROM comments c
            JOIN users u ON c.user_id = u.id
            WHERE c.post_id = ?
            ORDER BY c.created_at ASC
        """, (post_id,))
        rows = cursor.fetchall()
        comments = [dict(r) for r in rows]
        conn.close()
        self._send_json(comments)

    def _handle_create_comment(self, post_id, data, active_user_id):
        content = data.get("content", "").strip()
        if not content:
            self._send_error("Comment content cannot be empty")
            return

        conn = db.get_connection()
        cursor = conn.cursor()
        now = datetime.datetime.now().isoformat()
        cursor.execute("""
            INSERT INTO comments (post_id, user_id, content, created_at)
            VALUES (?, ?, ?, ?)
        """, (post_id, active_user_id, content, now))

        cursor.execute("SELECT user_id FROM posts WHERE id = ?", (post_id,))
        prow = cursor.fetchone()
        if prow and prow["user_id"] != active_user_id:
            cursor.execute("""
                INSERT INTO notifications (user_id, actor_id, type, target_id, is_read, created_at)
                VALUES (?, ?, 'comment', ?, 0, ?)
            """, (prow["user_id"], active_user_id, post_id, now))

        conn.commit()
        conn.close()
        self._send_json({"success": True, "message": "Comment added successfully"})

    def _handle_get_messages(self, active_user_id, contact_id):
        conn = db.get_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT m.*, s.handle as sender_handle, s.name as sender_name, s.avatar as sender_avatar
            FROM messages m
            JOIN users s ON m.sender_id = s.id
            WHERE (m.sender_id = ? AND m.receiver_id = ?)
               OR (m.sender_id = ? AND m.receiver_id = ?)
            ORDER BY m.created_at ASC
        """, (active_user_id, contact_id, contact_id, active_user_id))
        messages = [dict(r) for r in cursor.fetchall()]
        conn.close()
        self._send_json(messages)

    def _handle_get_message_contacts(self, active_user_id):
        conn = db.get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM users WHERE id != ? ORDER BY name ASC", (active_user_id,))
        contacts = [dict(r) for r in cursor.fetchall()]
        conn.close()
        self._send_json(contacts)

    def _handle_send_message(self, data, active_user_id):
        receiver_id = data.get("receiver_id")
        content = data.get("content", "").strip()

        if not receiver_id or not content:
            self._send_error("Receiver ID and message content are required")
            return

        conn = db.get_connection()
        cursor = conn.cursor()
        now = datetime.datetime.now().isoformat()
        cursor.execute("""
            INSERT INTO messages (sender_id, receiver_id, content, created_at)
            VALUES (?, ?, ?, ?)
        """, (active_user_id, receiver_id, content, now))

        cursor.execute("""
            INSERT INTO notifications (user_id, actor_id, type, target_id, is_read, created_at)
            VALUES (?, ?, 'message', ?, 0, ?)
        """, (receiver_id, active_user_id, cursor.lastrowid, now))

        conn.commit()
        conn.close()
        self._send_json({"success": True, "message": "Message sent"})

    def _handle_get_notifications(self, active_user_id):
        conn = db.get_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT n.*, a.handle as actor_handle, a.name as actor_name, a.avatar as actor_avatar
            FROM notifications n
            JOIN users a ON n.actor_id = a.id
            WHERE n.user_id = ?
            ORDER BY n.created_at DESC
        """, (active_user_id,))
        notifications = [dict(r) for r in cursor.fetchall()]
        conn.close()
        self._send_json(notifications)

    def _handle_read_notifications(self, active_user_id):
        conn = db.get_connection()
        cursor = conn.cursor()
        cursor.execute("UPDATE notifications SET is_read = 1 WHERE user_id = ?", (active_user_id,))
        conn.commit()
        conn.close()
        self._send_json({"success": True})

    # --- STATIC FILE SERVER ---
    def _serve_static(self, path):
        if path == "/":
            path = "/index.html"

        file_path = os.path.join(STATIC_DIR, path.lstrip("/"))
        if not os.path.exists(file_path) or os.path.isdir(file_path):
            file_path = os.path.join(STATIC_DIR, "index.html")

        ext = os.path.splitext(file_path)[1].lower()
        mime_types = {
            ".html": "text/html",
            ".css": "text/css",
            ".js": "application/javascript",
            ".json": "application/json",
            ".png": "image/png",
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".svg": "image/svg+xml",
            ".ico": "image/x-icon"
        }

        content_type = mime_types.get(ext, "application/octet-stream")

        try:
            with open(file_path, "rb") as f:
                content = f.read()
            self.send_response(200)
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", len(content))
            self.end_headers()
            self.wfile.write(content)
        except Exception as e:
            self._send_error(f"Error reading static file: {str(e)}", 500)

def run_server():
    server_address = ("", PORT)
    httpd = socketserver.TCPServer(server_address, SocialAppRequestHandler)
    print(f"PulseSocial Server running live at http://localhost:{PORT}")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down server...")
        httpd.server_close()

if __name__ == "__main__":
    run_server()
