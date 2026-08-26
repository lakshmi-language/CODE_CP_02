// Small client-side niceties for MiniSocial.

document.addEventListener("DOMContentLoaded", function () {
    // Confirm before deleting a post.
    document.querySelectorAll(".btn-small.danger").forEach(function (button) {
        button.addEventListener("click", function (event) {
            const confirmed = confirm("Delete this post? This can't be undone.");
            if (!confirmed) {
                event.preventDefault();
            }
        });
    });
});
