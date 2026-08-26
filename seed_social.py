from django.contrib.auth.models import User
from django.core.management.base import BaseCommand

from social.models import Comment, Follow, Like, Post

SAMPLE_USERS = [
    ("alice", "alice@example.com", "Photographer & coffee lover."),
    ("bob", "bob@example.com", "Building things with code."),
    ("carol", "carol@example.com", "Traveling the world, one city at a time."),
]

SAMPLE_POSTS = {
    "alice": ["Just watched the sunrise over the mountains 🌄", "New camera lens arrived today!"],
    "bob": ["Shipped a new feature today 🚀", "Debugging is 90% of my life."],
    "carol": ["Landed in Tokyo! First stop: ramen 🍜", "Exploring the old town today."],
}


class Command(BaseCommand):
    help = "Seed the database with sample users, posts, follows, likes, and comments"

    def handle(self, *args, **options):
        users = {}
        for username, email, bio in SAMPLE_USERS:
            user, created = User.objects.get_or_create(username=username, defaults={"email": email})
            if created:
                user.set_password("password123")
                user.save()
            user.profile.bio = bio
            user.profile.save()
            users[username] = user

        posts = []
        for username, contents in SAMPLE_POSTS.items():
            for content in contents:
                post, _ = Post.objects.get_or_create(author=users[username], content=content)
                posts.append(post)

        # everyone follows everyone else
        for follower in users.values():
            for following in users.values():
                if follower != following:
                    Follow.objects.get_or_create(follower=follower, following=following)

        # a few likes and comments
        if posts:
            Like.objects.get_or_create(post=posts[0], user=users["bob"])
            Like.objects.get_or_create(post=posts[0], user=users["carol"])
            Comment.objects.get_or_create(
                post=posts[0], author=users["bob"], content="Beautiful shot!"
            )

        self.stdout.write(self.style.SUCCESS("Seeded sample users (password: password123), posts, follows, likes, comments."))
