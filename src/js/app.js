const SECTIONS = {
  front: document.getElementById("front-section"),
  map: document.getElementById("map-section"),
  album: document.getElementById("album-section"),
  stats: document.getElementById("stats-section"),
  back: document.getElementById("back-section"),
};

const hideAllSections = () => {
  for (const key in SECTIONS) SECTIONS[key].hidden = true;
};

const switchSection = (sectionName) => {
  hideAllSections();
  SECTIONS[sectionName].hidden = false;
};

document.addEventListener("DOMContentLoaded", () => {
  /*  open with front section */
  switchSection("front");

  const ribbonButtons = document.querySelectorAll("button.ribbon");
  for (const button of ribbonButtons) {
    button.addEventListener("click", () => switchSection(button.value));
  }
});
