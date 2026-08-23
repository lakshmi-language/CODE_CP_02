from django.contrib import messages
from django.contrib.auth import login
from django.contrib.auth.decorators import login_required
from django.contrib.auth.models import User
from django.shortcuts import get_object_or_404, redirect, render

from .forms import CommentForm, PostForm, ProfileForm, RegisterForm
from .models import Follow, Post


@login_required
def feed(request):
    """Show posts from people the user follows, plus their own posts."""
    following_ids = request.user.following.values_list("following_id", flat=True)
    posts = Post.objects.filter(author_id__in=list(following_ids) + [request.user.id])

    if request.method == "POST":
        form = PostForm(request.POST, request.FILES)
        if form.is_valid():
            post = form.save(commit=False)
            post.author = request.user
            post.save()
            messages.success(request, "Post published!")
            return redirect("feed")
    else:
        form = PostForm()

    return render(request, "social/feed.html", {"posts": posts, "form": form})


def explore(request):
    """All posts, for discovering new people (works for anonymous users too)."""
    posts = Post.objects.all()
    return render(request, "social/explore.html", {"posts": posts})


def post_detail(request, pk):
    post = get_object_or_404(Post, pk=pk)
    comments = post.comments.all()

    if request.method == "POST":
        if not request.user.is_authenticated:
            return redirect("login")
        form = CommentForm(request.POST)
        if form.is_valid():
            comment = form.save(commit=False)
            comment.post = post
            comment.author = request.user
            comment.save()
            return redirect("post_detail", pk=post.pk)
    else:
        form = CommentForm()

    return render(request, "social/post_detail.html", {"post": post, "comments": comments, "form": form})


@login_required
def post_delete(request, pk):
    post = get_object_or_404(Post, pk=pk, author=request.user)
    if request.method == "POST":
        post.delete()
        messages.info(request, "Post deleted.")
    return redirect("feed")


@login_required
def like_toggle(request, pk):
    post = get_object_or_404(Post, pk=pk)
    like, created = post.likes.get_or_create(user=request.user)
    if not created:
        like.delete()  # already liked -> unlike
    next_url = request.POST.get("next") or "feed"
    return redirect(next_url)


@login_required
def follow_toggle(request, username):
    target = get_object_or_404(User, username=username)
    if target != request.user:
        follow, created = Follow.objects.get_or_create(follower=request.user, following=target)
        if not created:
            follow.delete()  # already following -> unfollow
    return redirect("profile", username=username)


def profile_view(request, username):
    profile_user = get_object_or_404(User, username=username)
    posts = profile_user.posts.all()
    is_following = (
        request.user.is_authenticated
        and Follow.objects.filter(follower=request.user, following=profile_user).exists()
    )
    return render(
        request,
        "social/profile.html",
        {"profile_user": profile_user, "posts": posts, "is_following": is_following},
    )


@login_required
def profile_edit(request):
    if request.method == "POST":
        form = ProfileForm(request.POST, request.FILES, instance=request.user.profile)
        if form.is_valid():
            form.save()
            messages.success(request, "Profile updated.")
            return redirect("profile", username=request.user.username)
    else:
        form = ProfileForm(instance=request.user.profile)
    return render(request, "social/profile_edit.html", {"form": form})


def register(request):
    if request.method == "POST":
        form = RegisterForm(request.POST)
        if form.is_valid():
            user = form.save()
            login(request, user)
            messages.success(request, "Account created! You're now logged in.")
            return redirect("feed")
    else:
        form = RegisterForm()
    return render(request, "registration/register.html", {"form": form})
