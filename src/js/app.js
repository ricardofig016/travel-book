const sections = {
  front: document.getElementById("front-section"),
  map: document.getElementById("map-section"),
  album: document.getElementById("album-section"),
  stats: document.getElementById("stats-section"),
  back: document.getElementById("back-section"),
};
const leftRibbonsContainer = document.getElementById("left-ribbons");
const leftRibbons = {
  front: leftRibbonsContainer.querySelector(".ribbon-front"),
  map: leftRibbonsContainer.querySelector(".ribbon-map"),
  album: leftRibbonsContainer.querySelector(".ribbon-album"),
  stats: leftRibbonsContainer.querySelector(".ribbon-stats"),
  back: leftRibbonsContainer.querySelector(".ribbon-back"),
};
const rightRibbonsContainer = document.getElementById("right-ribbons");
const rightRibbons = {
  front: rightRibbonsContainer.querySelector(".ribbon-front"),
  map: rightRibbonsContainer.querySelector(".ribbon-map"),
  album: rightRibbonsContainer.querySelector(".ribbon-album"),
  stats: rightRibbonsContainer.querySelector(".ribbon-stats"),
  back: rightRibbonsContainer.querySelector(".ribbon-back"),
};

const hideAllSections = () => {
  for (const s in sections) sections[s].hidden = true;
  for (const r in leftRibbons) leftRibbons[r].hidden = true;
  for (const r in rightRibbons) rightRibbons[r].hidden = true;
};

const switchSection = (sectionName) => {
  hideAllSections();
  sections[sectionName].hidden = false;
  for (const key in leftRibbons) {
    if (key != sectionName) leftRibbons[key].hidden = false;
    else break;
  }
  const reversedRightRibbonKeys = Object.keys(rightRibbons).reverse();
  for (const key of reversedRightRibbonKeys) {
    if (key != sectionName) rightRibbons[key].hidden = false;
    else break;
  }
};

document.addEventListener("DOMContentLoaded", () => {
  /*  open with front section */
  switchSection("front");

  const ribbonButtons = document.querySelectorAll("button.ribbon");
  for (const button of ribbonButtons) {
    button.addEventListener("click", () => switchSection(button.value));
  }
});
