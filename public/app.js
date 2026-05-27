const form = document.querySelector("#userForm");
const userIdInput = document.querySelector("#userId");
const nameInput = document.querySelector("#name");
const emailInput = document.querySelector("#email");
const postTitleInput = document.querySelector("#postTitle");
const postContentInput = document.querySelector("#postContent");
const saveButton = document.querySelector("#saveButton");
const cancelButton = document.querySelector("#cancelButton");
const refreshButton = document.querySelector("#refreshButton");
const usersContainer = document.querySelector("#users");
const userCount = document.querySelector("#userCount");
const message = document.querySelector("#message");

let users = [];

function showMessage(text) {
  message.textContent = text;
}

function clearMessage() {
  message.textContent = "";
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
    ...options,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error ?? "Request failed.");
  }

  return data;
}

function resetForm() {
  form.reset();
  userIdInput.value = "";
  postTitleInput.disabled = false;
  postContentInput.disabled = false;
  saveButton.textContent = "Create user";
  cancelButton.hidden = true;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function startEdit(user) {
  userIdInput.value = user.id;
  nameInput.value = user.name ?? "";
  emailInput.value = user.email;
  postTitleInput.value = "";
  postContentInput.value = "";
  postTitleInput.disabled = true;
  postContentInput.disabled = true;
  saveButton.textContent = "Update user";
  cancelButton.hidden = false;
  nameInput.focus();
}

function userTemplate(user) {
  const posts = user.posts.length
    ? user.posts
        .map(
          (post) => `
            <li class="post">
              <div>
                <p class="post-title">${escapeHtml(post.title)}</p>
                <p class="post-content">${escapeHtml(post.content ?? "No content")}</p>
              </div>
              <button
                class="status ${post.published ? "published" : ""}"
                data-action="toggle-post"
                data-id="${post.id}"
                type="button"
              >
                ${post.published ? "Published" : "Draft"}
              </button>
            </li>
          `,
        )
        .join("")
    : `<li class="post"><p class="post-content">No posts yet</p></li>`;

  return `
    <article class="user-card">
      <div class="user-main">
        <h3 class="user-name">${escapeHtml(user.name ?? "Unnamed user")}</h3>
        <p class="user-email">${escapeHtml(user.email)}</p>
      </div>
      <div class="card-actions">
        <button data-action="edit-user" data-id="${user.id}" type="button">Edit</button>
        <button class="danger" data-action="delete-user" data-id="${user.id}" type="button">
          Delete
        </button>
      </div>
      <ul class="posts">${posts}</ul>
    </article>
  `;
}

function renderUsers() {
  userCount.textContent = `${users.length} ${users.length === 1 ? "record" : "records"}`;

  if (!users.length) {
    usersContainer.innerHTML = `<div class="empty-state">No users yet.</div>`;
    return;
  }

  usersContainer.innerHTML = users.map(userTemplate).join("");
}

async function loadUsers() {
  clearMessage();
  users = await requestJson("/api/users");
  renderUsers();
}

async function saveUser(event) {
  event.preventDefault();
  clearMessage();

  const id = userIdInput.value;
  const payload = {
    name: nameInput.value,
    email: emailInput.value,
    postTitle: postTitleInput.value,
    postContent: postContentInput.value,
  };

  try {
    if (id) {
      await requestJson(`/api/users/${id}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
    } else {
      await requestJson("/api/users", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    }

    resetForm();
    await loadUsers();
  } catch (error) {
    showMessage(error.message);
  }
}

async function handleListClick(event) {
  const button = event.target.closest("button");

  if (!button) {
    return;
  }

  const id = Number(button.dataset.id);
  const user = users.find((currentUser) => currentUser.id === id);

  try {
    if (button.dataset.action === "edit-user" && user) {
      startEdit(user);
    }

    if (button.dataset.action === "delete-user") {
      await requestJson(`/api/users/${id}`, {
        method: "DELETE",
      });
      await loadUsers();
    }

    if (button.dataset.action === "toggle-post") {
      await requestJson(`/api/posts/${id}/toggle`, {
        method: "PATCH",
      });
      await loadUsers();
    }
  } catch (error) {
    showMessage(error.message);
  }
}

form.addEventListener("submit", saveUser);
cancelButton.addEventListener("click", resetForm);
refreshButton.addEventListener("click", loadUsers);
usersContainer.addEventListener("click", handleListClick);

loadUsers().catch((error) => {
  showMessage(error.message);
});
