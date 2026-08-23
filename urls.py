from django.urls import path

from . import views

urlpatterns = [
    path("", views.feed, name="feed"),
    path("explore/", views.explore, name="explore"),

    path("post/<int:pk>/", views.post_detail, name="post_detail"),
    path("post/<int:pk>/delete/", views.post_delete, name="post_delete"),
    path("post/<int:pk>/like/", views.like_toggle, name="like_toggle"),

    path("profile/<str:username>/", views.profile_view, name="profile"),
    path("profile/<str:username>/follow/", views.follow_toggle, name="follow_toggle"),
    path("profile/edit/", views.profile_edit, name="profile_edit"),

    path("register/", views.register, name="register"),
]
