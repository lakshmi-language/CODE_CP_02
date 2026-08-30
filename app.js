/* ==========================================================================
   PulseSocial Platform Application Logic
   ========================================================================== */

document.addEventListener("DOMContentLoaded", () => {
  // Application State
  let state = {
    activeUser: { id: 1, handle: "alex_dev", name: "Alex Rivera", avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80" },
    users: [],
    currentView: "home",
    currentFeed: "for-you",
    searchQuery: "",
    activeProfileId: 1,
    activeChatContactId: null,
    attachedImageUrl: "",
    modalCommentPostId: null
  };

  // DOM Elements
  const postsContainer = document.getElementById("postsContainer");
  const feedTabs = document.getElementById("feedTabs");
  const viewTitle = document.getElementById("viewTitle");
  const searchInput = document.getElementById("searchInput");
  const clearSearchBtn = document.getElementById("clearSearchBtn");
  
  // Composer Elements
  const composerInput = document.getElementById("composerInput");
  const composerUserAvatar = document.getElementById("composerUserAvatar");
  const charCounter = document.getElementById("charCounter");
  const submitPostBtn = document.getElementById("submitPostBtn");
  const attachImageBtn = document.getElementById("attachImageBtn");
  const imagePreviewContainer = document.getElementById("imagePreviewContainer");
  const imagePreview = document.getElementById("imagePreview");
  const removeImageBtn = document.getElementById("removeImageBtn");
  
  // User Profile Sidebar Elements
  const activeUserAvatar = document.getElementById("activeUserAvatar");
  const activeUserName = document.getElementById("activeUserName");
  const activeUserHandle = document.getElementById("activeUserHandle");
  const userSwitcherTrigger = document.getElementById("userSwitcherTrigger");
  const sidebarProfileBtn = document.getElementById("sidebarProfileBtn");

  // Modals
  const userModal = document.getElementById("userModal");
  const commentsModal = document.getElementById("commentsModal");
  const imageUrlModal = document.getElementById("imageUrlModal");

  // Views
  const profileView = document.getElementById("profileView");
  const messagesView = document.getElementById("messagesView");
  const notificationsView = document.getElementById("notificationsView");
  const inlineComposer = document.getElementById("inlineComposer");

  // Theme
  const themeToggleBtn = document.getElementById("themeToggleBtn");
  const themeIconSun = document.getElementById("themeIconSun");
  const themeIconMoon = document.getElementById("themeIconMoon");

  // Initialize
  initApp();

  async function initApp() {
    setupEventListeners();
    await fetchUsers();
    setActiveUser(state.users.find(u => u.id === 1) || state.users[0]);
    loadCurrentView();
  }

  // --- API HELPERS ---
  async function apiFetch(url, options = {}) {
    options.headers = {
      "Content-Type": "application/json",
      "X-Active-User": state.activeUser ? state.activeUser.id : "1",
      ...(options.headers || {})
    };

    try {
      const response = await fetch(url, options);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "API Request Failed");
      }
      return data;
    } catch (err) {
      showToast(err.message || "Network Error");
      throw err;
    }
  }

  // --- USER STATE MANAGEMENT ---
  async function fetchUsers() {
    try {
      state.users = await apiFetch("/api/users");
      renderUserSwitcherList();
      renderWhoToFollowWidget();
    } catch (err) {
      console.error(err);
    }
  }

  function setActiveUser(user) {
    if (!user) return;
    state.activeUser = user;
    activeUserAvatar.src = user.avatar;
    activeUserName.textContent = user.name;
    activeUserHandle.textContent = `@${user.handle}`;
    composerUserAvatar.src = user.avatar;
    showToast(`Switched account to @${user.handle}`);
    loadCurrentView();
  }

  // --- VIEW & NAVIGATION ROUTER ---
  function setView(viewName) {
    state.currentView = viewName;

    // Update Sidebar Navigation buttons
    document.querySelectorAll(".nav-item").forEach(btn => {
      btn.classList.toggle("active", btn.dataset.view === viewName);
    });

    // Hide all view sections
    postsContainer.classList.add("hidden");
    feedTabs.classList.add("hidden");
    inlineComposer.classList.add("hidden");
    profileView.classList.add("hidden");
    messagesView.classList.add("hidden");
    notificationsView.classList.add("hidden");

    if (viewName === "home" || viewName === "explore" || viewName === "bookmarks") {
      postsContainer.classList.remove("hidden");
      feedTabs.classList.remove("hidden");
      inlineComposer.classList.remove("hidden");

      if (viewName === "home") {
        viewTitle.textContent = "Home Feed";
        state.currentFeed = "for-you";
      } else if (viewName === "explore") {
        viewTitle.textContent = "Explore";
        state.currentFeed = "trending";
      } else if (viewName === "bookmarks") {
        viewTitle.textContent = "Saved Bookmarks";
        state.currentFeed = "saved";
        inlineComposer.classList.add("hidden");
      }

      updateActiveTabUI();
      loadPosts();
    } else if (viewName === "profile") {
      profileView.classList.remove("hidden");
      viewTitle.textContent = "Profile";
      loadUserProfile(state.activeProfileId || state.activeUser.id);
    } else if (viewName === "messages") {
      messagesView.classList.remove("hidden");
      viewTitle.textContent = "Direct Messages";
      loadMessagesView();
    } else if (viewName === "notifications") {
      notificationsView.classList.remove("hidden");
      viewTitle.textContent = "Notifications";
      loadNotificationsView();
    }
  }

  function updateActiveTabUI() {
    document.querySelectorAll(".tab-item").forEach(btn => {
      btn.classList.toggle("active", btn.dataset.feed === state.currentFeed);
    });
  }

  function loadCurrentView() {
    setView(state.currentView);
  }

  // --- POSTS STREAM & ACTIONS ---
  async function loadPosts() {
    postsContainer.innerHTML = `
      <div class="loading-spinner">
        <div class="spinner"></div>
      </div>
    `;

    try {
      let queryParams = new URLSearchParams();
      queryParams.append("feed", state.currentFeed);

      if (state.searchQuery) {
        queryParams.append("q", state.searchQuery);
      }

      const posts = await apiFetch(`/api/posts?${queryParams.toString()}`);
      renderPosts(posts);
    } catch (err) {
      postsContainer.innerHTML = `<div class="empty-state">Failed to load posts.</div>`;
    }
  }

  function renderPosts(posts) {
    if (!posts || posts.length === 0) {
      postsContainer.innerHTML = `<div class="empty-state" style="padding:3rem; text-align:center; color:var(--text-secondary);">No posts found. Be the first to share something!</div>`;
      return;
    }

    postsContainer.innerHTML = "";
    posts.forEach(post => {
      postsContainer.appendChild(createPostCardElement(post));
    });
  }

  function createPostCardElement(post) {
    const card = document.createElement("article");
    card.className = "post-card";

    const isOwnPost = post.user_id === state.activeUser.id;
    const timeFormatted = formatTimeAgo(post.created_at);

    // Format post content with hashtag highlight
    const formattedContent = escapeHtml(post.content).replace(
      /#(\w+)/g,
      '<span class="post-hashtag" data-hashtag="$1">#$1</span>'
    );

    card.innerHTML = `
      <img src="${post.avatar}" alt="${post.name}" class="avatar-md profile-trigger" data-uid="${post.user_id}">
      <div class="post-body">
        <div class="post-header">
          <div class="post-author-info">
            <span class="post-author-name profile-trigger" data-uid="${post.user_id}">${escapeHtml(post.name)}</span>
            <span class="post-author-handle">@${escapeHtml(post.handle)}</span>
            <span class="post-time">• ${timeFormatted}</span>
          </div>
          ${isOwnPost ? `
            <button class="delete-post-btn icon-btn" title="Delete Post" data-pid="${post.id}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
            </button>
          ` : ''}
        </div>

        <p class="post-content">${formattedContent}</p>

        ${post.image_url ? `
          <div class="post-media-container">
            <img src="${post.image_url}" alt="Post Image" loading="lazy">
          </div>
        ` : ''}

        <div class="post-actions-row">
          <button class="action-item comment-btn" data-pid="${post.id}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
            </svg>
            <span>${post.comments_count || 0}</span>
          </button>

          <button class="action-item repost-btn ${post.is_reposted ? 'reposted' : ''}" data-pid="${post.id}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="17 1 21 5 17 9"></polyline>
              <path d="M3 11V9a4 4 0 0 1 4-4h14"></path>
              <polyline points="7 23 3 19 7 15"></polyline>
              <path d="M21 13v2a4 4 0 0 1-4 4H3"></path>
            </svg>
            <span>${post.reposts_count || 0}</span>
          </button>

          <button class="action-item like-btn ${post.is_liked ? 'liked' : ''}" data-pid="${post.id}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
            </svg>
            <span>${post.likes_count || 0}</span>
          </button>

          <button class="action-item bookmark-btn ${post.is_bookmarked ? 'bookmarked' : ''}" data-pid="${post.id}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
            </svg>
          </button>
        </div>
      </div>
    `;

    // Bind event listeners for card elements
    card.querySelectorAll(".profile-trigger").forEach(el => {
      el.addEventListener("click", () => {
        state.activeProfileId = parseInt(el.dataset.uid);
        setView("profile");
      });
    });

    card.querySelectorAll(".post-hashtag").forEach(el => {
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        const hashtag = el.dataset.hashtag;
        searchInput.value = `#${hashtag}`;
        state.searchQuery = `#${hashtag}`;
        clearSearchBtn.classList.remove("hidden");
        loadPosts();
      });
    });

    const likeBtn = card.querySelector(".like-btn");
    likeBtn.addEventListener("click", async () => {
      try {
        const res = await apiFetch(`/api/posts/${post.id}/like`, { method: "POST" });
        const countSpan = likeBtn.querySelector("span");
        let currentCnt = parseInt(countSpan.textContent);
        if (res.liked) {
          likeBtn.classList.add("liked");
          countSpan.textContent = currentCnt + 1;
        } else {
          likeBtn.classList.remove("liked");
          countSpan.textContent = Math.max(0, currentCnt - 1);
        }
      } catch (err) { console.error(err); }
    });

    const repostBtn = card.querySelector(".repost-btn");
    repostBtn.addEventListener("click", async () => {
      try {
        const res = await apiFetch(`/api/posts/${post.id}/repost`, { method: "POST" });
        const countSpan = repostBtn.querySelector("span");
        let currentCnt = parseInt(countSpan.textContent);
        if (res.reposted) {
          repostBtn.classList.add("reposted");
          countSpan.textContent = currentCnt + 1;
          showToast("Reposted to your profile!");
        } else {
          repostBtn.classList.remove("reposted");
          countSpan.textContent = Math.max(0, currentCnt - 1);
        }
      } catch (err) { console.error(err); }
    });

    const bookmarkBtn = card.querySelector(".bookmark-btn");
    bookmarkBtn.addEventListener("click", async () => {
      try {
        const res = await apiFetch(`/api/posts/${post.id}/bookmark`, { method: "POST" });
        if (res.bookmarked) {
          bookmarkBtn.classList.add("bookmarked");
          showToast("Saved to Bookmarks!");
        } else {
          bookmarkBtn.classList.remove("bookmarked");
          showToast("Removed from Bookmarks");
        }
      } catch (err) { console.error(err); }
    });

    const commentBtn = card.querySelector(".comment-btn");
    commentBtn.addEventListener("click", () => {
      openCommentsModal(post);
    });

    const deleteBtn = card.querySelector(".delete-post-btn");
    if (deleteBtn) {
      deleteBtn.addEventListener("click", async () => {
        if (confirm("Are you sure you want to delete this post?")) {
          try {
            await apiFetch(`/api/posts/${post.id}`, { method: "DELETE" });
            card.remove();
            showToast("Post deleted");
          } catch (err) { console.error(err); }
        }
      });
    }

    return card;
  }

  // --- POST COMPOSER LOGIC ---
  composerInput.addEventListener("input", () => {
    const len = composerInput.value.length;
    charCounter.textContent = 280 - len;
    submitPostBtn.disabled = len === 0 && !state.attachedImageUrl;
  });

  attachImageBtn.addEventListener("click", () => {
    imageUrlModal.classList.remove("hidden");
  });

  removeImageBtn.addEventListener("click", () => {
    state.attachedImageUrl = "";
    imagePreviewContainer.classList.add("hidden");
    submitPostBtn.disabled = composerInput.value.length === 0;
  });

  document.querySelectorAll(".preset-img-option").forEach(img => {
    img.addEventListener("click", () => {
      document.querySelectorAll(".preset-img-option").forEach(i => i.classList.remove("selected"));
      img.classList.add("selected");
      document.getElementById("customImageUrlInput").value = img.src;
    });
  });

  document.getElementById("confirmImageUrlBtn").addEventListener("click", () => {
    const url = document.getElementById("customImageUrlInput").value.trim();
    if (url) {
      state.attachedImageUrl = url;
      imagePreview.src = url;
      imagePreviewContainer.classList.remove("hidden");
      submitPostBtn.disabled = false;
      imageUrlModal.classList.add("hidden");
    }
  });

  submitPostBtn.addEventListener("click", async () => {
    const content = composerInput.value.trim();
    if (!content && !state.attachedImageUrl) return;

    submitPostBtn.disabled = true;
    try {
      await apiFetch("/api/posts", {
        method: "POST",
        body: JSON.stringify({
          content: content,
          image_url: state.attachedImageUrl
        })
      });

      // Reset composer
      composerInput.value = "";
      state.attachedImageUrl = "";
      imagePreviewContainer.classList.add("hidden");
      charCounter.textContent = "280";
      showToast("Your post was published!");

      // Refresh feed
      loadPosts();
    } catch (err) {
      submitPostBtn.disabled = false;
    }
  });

  // --- PROFILE VIEW LOGIC ---
  async function loadUserProfile(userId) {
    try {
      const user = await apiFetch(`/api/users/${userId}`);
      document.getElementById("profileBanner").src = user.banner;
      document.getElementById("profileAvatar").src = user.avatar;
      document.getElementById("profileName").textContent = user.name;
      document.getElementById("profileHandle").textContent = `@${user.handle}`;
      document.getElementById("profileBio").textContent = user.bio || "No bio yet.";
      document.getElementById("profileFollowingCount").textContent = user.following_count || 0;
      document.getElementById("profileFollowersCount").textContent = user.followers_count || 0;
      document.getElementById("profilePostsCount").textContent = user.posts_count || 0;

      const followBtn = document.getElementById("profileFollowBtn");
      if (userId === state.activeUser.id) {
        followBtn.classList.add("hidden");
      } else {
        followBtn.classList.remove("hidden");
        followBtn.textContent = user.is_following ? "Following" : "Follow";
        followBtn.className = user.is_following ? "btn btn-outline" : "btn btn-primary";

        followBtn.onclick = async () => {
          try {
            const res = await apiFetch(`/api/users/${userId}/follow`, { method: "POST" });
            user.is_following = res.following;
            followBtn.textContent = res.following ? "Following" : "Follow";
            followBtn.className = res.following ? "btn btn-outline" : "btn btn-primary";
            fetchUsers(); // Refresh WHO TO FOLLOW list
          } catch (err) { console.error(err); }
        };
      }

      // Load user posts
      const userPosts = await apiFetch(`/api/posts?user_id=${userId}`);
      const pContainer = document.getElementById("profilePostsContainer");
      pContainer.innerHTML = "";
      if (userPosts.length === 0) {
        pContainer.innerHTML = `<div class="empty-state" style="padding:2rem; text-align:center; color:var(--text-secondary);">This user has not posted anything yet.</div>`;
      } else {
        userPosts.forEach(post => pContainer.appendChild(createPostCardElement(post)));
      }
    } catch (err) { console.error(err); }
  }

  // --- COMMENTS MODAL LOGIC ---
  async function openCommentsModal(post) {
    state.modalCommentPostId = post.id;
    const targetBox = document.getElementById("modalTargetPost");
    targetBox.innerHTML = "";
    targetBox.appendChild(createPostCardElement(post));

    commentsModal.classList.remove("hidden");
    loadComments(post.id);
  }

  async function loadComments(postId) {
    const list = document.getElementById("commentsList");
    list.innerHTML = `<div class="loading-spinner"><div class="spinner"></div></div>`;

    try {
      const comments = await apiFetch(`/api/posts/${postId}/comments`);
      list.innerHTML = "";
      if (comments.length === 0) {
        list.innerHTML = `<div style="text-align:center; color:var(--text-secondary); padding:1rem;">No comments yet. Start the conversation!</div>`;
        return;
      }
      comments.forEach(c => {
        const item = document.createElement("div");
        item.className = "comment-item";
        item.innerHTML = `
          <img src="${c.avatar}" class="avatar-sm" alt="${c.name}">
          <div class="comment-body">
            <div style="font-weight:700; font-size:0.88rem;">${escapeHtml(c.name)} <span style="font-weight:400; color:var(--text-secondary);">@${escapeHtml(c.handle)} • ${formatTimeAgo(c.created_at)}</span></div>
            <p style="font-size:0.92rem; margin-top:0.25rem;">${escapeHtml(c.content)}</p>
          </div>
        `;
        list.appendChild(item);
      });
    } catch (err) { console.error(err); }
  }

  document.getElementById("submitCommentBtn").addEventListener("click", async () => {
    const input = document.getElementById("commentInput");
    const content = input.value.trim();
    if (!content || !state.modalCommentPostId) return;

    try {
      await apiFetch(`/api/posts/${state.modalCommentPostId}/comments`, {
        method: "POST",
        body: JSON.stringify({ content })
      });
      input.value = "";
      loadComments(state.modalCommentPostId);
      showToast("Comment added!");
    } catch (err) { console.error(err); }
  });

  // --- MESSAGES VIEW LOGIC ---
  async function loadMessagesView() {
    const contactsList = document.getElementById("contactsList");
    contactsList.innerHTML = `<div class="loading-spinner"><div class="spinner"></div></div>`;

    try {
      const contacts = await apiFetch("/api/messages");
      contactsList.innerHTML = "";
      if (contacts.length === 0) {
        contactsList.innerHTML = `<div class="empty-state">No contacts found</div>`;
        return;
      }

      contacts.forEach(c => {
        const card = document.createElement("div");
        card.className = `contact-card ${c.id === state.activeChatContactId ? 'active' : ''}`;
        card.innerHTML = `
          <img src="${c.avatar}" class="avatar-sm" alt="${c.name}">
          <div class="user-info">
            <span class="user-name">${escapeHtml(c.name)}</span>
            <span class="user-handle">@${escapeHtml(c.handle)}</span>
          </div>
        `;
        card.addEventListener("click", () => {
          document.querySelectorAll(".contact-card").forEach(el => el.classList.remove("active"));
          card.classList.add("active");
          openChatThread(c);
        });
        contactsList.appendChild(card);
      });

      if (!state.activeChatContactId && contacts.length > 0) {
        openChatThread(contacts[0]);
      }
    } catch (err) { console.error(err); }
  }

  async function openChatThread(contact) {
    state.activeChatContactId = contact.id;
    document.getElementById("chatHeader").classList.remove("hidden");
    document.getElementById("chatInputRow").classList.remove("hidden");

    document.getElementById("chatContactAvatar").src = contact.avatar;
    document.getElementById("chatContactName").textContent = contact.name;
    document.getElementById("chatContactHandle").textContent = `@${contact.handle}`;

    loadMessages();
  }

  async function loadMessages() {
    if (!state.activeChatContactId) return;
    const msgBox = document.getElementById("chatMessages");
    try {
      const messages = await apiFetch(`/api/messages?contact_id=${state.activeChatContactId}`);
      msgBox.innerHTML = "";
      if (messages.length === 0) {
        msgBox.innerHTML = `<div class="empty-state">No message history yet. Say hi!</div>`;
        return;
      }
      messages.forEach(m => {
        const bubble = document.createElement("div");
        const isSent = m.sender_id === state.activeUser.id;
        bubble.className = `msg-bubble ${isSent ? 'sent' : 'received'}`;
        bubble.textContent = m.content;
        msgBox.appendChild(bubble);
      });
      msgBox.scrollTop = msgBox.scrollHeight;
    } catch (err) { console.error(err); }
  }

  document.getElementById("sendMessageBtn").addEventListener("click", async () => {
    const input = document.getElementById("chatInput");
    const content = input.value.trim();
    if (!content || !state.activeChatContactId) return;

    try {
      await apiFetch("/api/messages", {
        method: "POST",
        body: JSON.stringify({
          receiver_id: state.activeChatContactId,
          content: content
        })
      });
      input.value = "";
      loadMessages();
    } catch (err) { console.error(err); }
  });

  // --- NOTIFICATIONS VIEW LOGIC ---
  async function loadNotificationsView() {
    const list = document.getElementById("notificationsList");
    list.innerHTML = `<div class="loading-spinner"><div class="spinner"></div></div>`;

    try {
      const notifications = await apiFetch("/api/notifications");
      list.innerHTML = "";

      let unreadCnt = 0;
      if (notifications.length === 0) {
        list.innerHTML = `<div class="empty-state" style="padding:2rem; text-align:center; color:var(--text-secondary);">No notifications yet.</div>`;
      } else {
        notifications.forEach(n => {
          if (!n.is_read) unreadCnt++;
          const item = document.createElement("div");
          item.className = `notification-item ${n.is_read ? '' : 'unread'}`;
          
          let actionText = "interacted with your profile";
          if (n.type === "like") actionText = "liked your post";
          else if (n.type === "comment") actionText = "commented on your post";
          else if (n.type === "repost") actionText = "reposted your post";
          else if (n.type === "follow") actionText = "started following you";

          item.innerHTML = `
            <img src="${n.actor_avatar}" class="avatar-sm" alt="${n.actor_name}">
            <div>
              <strong style="font-size:0.92rem;">${escapeHtml(n.actor_name)}</strong>
              <span style="color:var(--text-secondary); font-size:0.9rem;">${actionText}</span>
              <div style="font-size:0.78rem; color:var(--text-secondary); margin-top:0.2rem;">${formatTimeAgo(n.created_at)}</div>
            </div>
          `;
          list.appendChild(item);
        });
      }

      updateUnreadBadge(unreadCnt);
    } catch (err) { console.error(err); }
  }

  document.getElementById("markAllReadBtn").addEventListener("click", async () => {
    try {
      await apiFetch("/api/notifications/read", { method: "POST" });
      loadNotificationsView();
      showToast("All notifications marked as read");
    } catch (err) { console.error(err); }
  });

  function updateUnreadBadge(cnt) {
    const badge = document.getElementById("unreadBadge");
    if (cnt > 0) {
      badge.textContent = cnt;
      badge.classList.remove("hidden");
    } else {
      badge.classList.add("hidden");
    }
  }

  // --- USER SWITCHER MODAL & REGISTRATION ---
  function renderUserSwitcherList() {
    const grid = document.getElementById("usersList");
    grid.innerHTML = "";
    state.users.forEach(u => {
      const card = document.createElement("div");
      card.className = `user-select-card ${u.id === state.activeUser.id ? 'active' : ''}`;
      card.innerHTML = `
        <div style="display:flex; align-items:center; gap:0.75rem;">
          <img src="${u.avatar}" class="avatar-sm" alt="${u.name}">
          <div class="user-info">
            <span class="user-name">${escapeHtml(u.name)}</span>
            <span class="user-handle">@${escapeHtml(u.handle)}</span>
          </div>
        </div>
        ${u.id === state.activeUser.id ? '<span style="color:var(--accent-color); font-weight:700; font-size:0.85rem;">Active</span>' : ''}
      `;
      card.addEventListener("click", () => {
        setActiveUser(u);
        userModal.classList.add("hidden");
      });
      grid.appendChild(card);
    });
  }

  document.getElementById("createUserForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = document.getElementById("newUserName").value.trim();
    const handle = document.getElementById("newUserHandle").value.trim();
    const bio = document.getElementById("newUserBio").value.trim();
    const avatar = document.getElementById("newUserAvatar").value.trim();

    try {
      const newUser = await apiFetch("/api/users", {
        method: "POST",
        body: JSON.stringify({ name, handle, bio, avatar })
      });
      await fetchUsers();
      setActiveUser(newUser);
      userModal.classList.add("hidden");
      document.getElementById("createUserForm").reset();
    } catch (err) { console.error(err); }
  });

  // --- WHO TO FOLLOW WIDGET ---
  function renderWhoToFollowWidget() {
    const list = document.getElementById("whoToFollowList");
    list.innerHTML = "";

    const suggestUsers = state.users.filter(u => u.id !== state.activeUser.id);
    suggestUsers.slice(0, 3).forEach(u => {
      const item = document.createElement("div");
      item.className = "follow-item";
      item.innerHTML = `
        <div class="follow-item-info">
          <img src="${u.avatar}" class="avatar-sm" alt="${u.name}">
          <div class="user-info">
            <span class="user-name" style="cursor:pointer;">${escapeHtml(u.name)}</span>
            <span class="user-handle">@${escapeHtml(u.handle)}</span>
          </div>
        </div>
        <button class="btn ${u.is_following ? 'btn-outline' : 'btn-primary'} btn-sm follow-toggle-btn">${u.is_following ? 'Following' : 'Follow'}</button>
      `;

      item.querySelector(".user-name").addEventListener("click", () => {
        state.activeProfileId = u.id;
        setView("profile");
      });

      const fBtn = item.querySelector(".follow-toggle-btn");
      fBtn.addEventListener("click", async () => {
        try {
          const res = await apiFetch(`/api/users/${u.id}/follow`, { method: "POST" });
          u.is_following = res.following;
          fBtn.textContent = res.following ? "Following" : "Follow";
          fBtn.className = res.following ? "btn btn-outline btn-sm follow-toggle-btn" : "btn btn-primary btn-sm follow-toggle-btn";
        } catch (err) { console.error(err); }
      });

      list.appendChild(item);
    });
  }

  // --- EVENT LISTENERS BINDING ---
  function setupEventListeners() {
    // Navigation bar click listeners
    document.querySelectorAll(".nav-item").forEach(btn => {
      btn.addEventListener("click", () => setView(btn.dataset.view));
    });

    // Sidebar Profile button
    sidebarProfileBtn.addEventListener("click", () => {
      state.activeProfileId = state.activeUser.id;
      setView("profile");
    });

    // Feed Sub-tabs
    feedTabs.querySelectorAll(".tab-item").forEach(tab => {
      tab.addEventListener("click", () => {
        state.currentFeed = tab.dataset.feed;
        updateActiveTabUI();
        loadPosts();
      });
    });

    // Trending Widget tags click
    document.querySelectorAll(".trending-list li").forEach(li => {
      li.addEventListener("click", () => {
        const tag = li.dataset.tag;
        searchInput.value = `#${tag}`;
        state.searchQuery = `#${tag}`;
        clearSearchBtn.classList.remove("hidden");
        setView("home");
      });
    });

    // Search bar input
    let searchDebounce;
    searchInput.addEventListener("input", (e) => {
      clearTimeout(searchDebounce);
      const val = e.target.value.trim();
      clearSearchBtn.classList.toggle("hidden", val.length === 0);

      searchDebounce = setTimeout(() => {
        state.searchQuery = val;
        loadPosts();
      }, 300);
    });

    clearSearchBtn.addEventListener("click", () => {
      searchInput.value = "";
      state.searchQuery = "";
      clearSearchBtn.classList.add("hidden");
      loadPosts();
    });

    // Modal Close Triggers
    document.querySelectorAll("[data-close]").forEach(btn => {
      btn.addEventListener("click", () => {
        document.getElementById(btn.dataset.close).classList.add("hidden");
      });
    });

    userSwitcherTrigger.addEventListener("click", () => {
      userModal.classList.remove("hidden");
    });

    document.getElementById("openPostModalBtn").addEventListener("click", () => {
      window.scrollTo({ top: 0, behavior: "smooth" });
      composerInput.focus();
    });

    // Theme Switcher Toggle
    themeToggleBtn.addEventListener("click", () => {
      const currentTheme = document.documentElement.getAttribute("data-theme");
      const nextTheme = currentTheme === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", nextTheme);

      if (nextTheme === "light") {
        themeIconSun.classList.remove("hidden");
        themeIconMoon.classList.add("hidden");
      } else {
        themeIconSun.classList.add("hidden");
        themeIconMoon.classList.remove("hidden");
      }
    });
  }

  // --- UTILITIES ---
  function showToast(msg) {
    const container = document.getElementById("toastContainer");
    const toast = document.createElement("div");
    toast.className = "toast";
    toast.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px;height:18px;color:var(--accent-color);">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
        <polyline points="22 4 12 14.01 9 11.01"></polyline>
      </svg>
      <span>${escapeHtml(msg)}</span>
    `;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateY(20px)";
      toast.style.transition = "all 0.3s";
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  function formatTimeAgo(isoString) {
    if (!isoString) return "just now";
    const date = new Date(isoString);
    const now = new Date();
    const diffSec = Math.floor((now - date) / 1000);

    if (diffSec < 60) return "just now";
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
    return `${Math.floor(diffSec / 86400)}d ago`;
  }

  function escapeHtml(str) {
    if (!str) return "";
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
});
