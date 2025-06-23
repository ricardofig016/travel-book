document.addEventListener("DOMContentLoaded", () => {
  const app = document.getElementById("app");
  const sections = {
    front: document.getElementById("front-section"),
    map: document.getElementById("map-section"),
    album: document.getElementById("album-section"),
    stats: document.getElementById("stats-section"),
    back: document.getElementById("back-section"),
  };
  const navButtons = sections.front.querySelectorAll("button");
  navButtons.forEach((button) => {
    button.addEventListener("click", () => {
      console.log(`Switching to ${button.className.split("-")[0]} section`);
      sections.front.hidden = true;
      sections[button.className.split("-")[0]].hidden = false;
    });
  });
});
