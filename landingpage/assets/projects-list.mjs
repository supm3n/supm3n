// landingpage/assets/projects-list.mjs
// Fetches and renders the list returned by /api/projects into #projects-list

export async function renderProjects(elId = "projects-list") {
  try {
    const res = await fetch("/api/projects", { headers: { "accept": "application/json" } });
    if (!res.ok) throw new Error("Failed to fetch /api/projects");
    const items = await res.json();
    const el = document.getElementById(elId);
    if (!el) return;

    el.innerHTML = items.map(p => `
      <li class="project">
        <a href="${p.url}">${p.name}</a>
        ${p.description ? `<small>${p.description}</small>` : ""}
      </li>
    `).join("");
  } catch (e) {
    console.error(e);
  }
}

// auto-run on DOM ready if an element with id="projects-list" exists
document.addEventListener("DOMContentLoaded", () => {
  const el = document.getElementById("projects-list");
  if (el) renderProjects("projects-list");
});
