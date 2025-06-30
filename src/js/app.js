import { PageFlip } from "page-flip"; // docs: https://nodlik.github.io/StPageFlip/docs/classes/pageflip.html

// constants
const book = document.getElementById("book");
const pageWidthPixels = 411;
const pageHeightPixels = 570;
const mainPageNames = ["front", "map", "album", "stats", "back"];
const leftRibbonsContainer = document.getElementById("left-ribbons");
const rightRibbonsContainer = document.getElementById("right-ribbons");

// load book
const pageFlip = new PageFlip(book, {
  width: pageWidthPixels,
  height: pageHeightPixels,
  size: "fixed",
  minShadowOpacity: 0.2,
  maxShadowOpacity: 0.6,
  showCover: true,
  mobileScrollSupport: false,
});
pageFlip.loadFromHTML(document.querySelectorAll(".page"));

// functions
const getPagesContainer = () => {
  return book.querySelector(".page").parentNode;
};

const getMainPageIndex = (pageName) => {
  if (!mainPageNames.includes(pageName)) throw new Error(`Unknown main page name: ${pageName}`);
  const pages = Array.from(document.querySelectorAll(".page"));
  const page = pages.find((p) => p.id === `${pageName}-main-page`);
  return page ? pages.indexOf(page) : -1;
};

const updateBook = () => {
  pageFlip.updateFromHtml(document.querySelectorAll(".page"));
  pageFlip.update();
};

const addPage = (index, innerHTML = "", isBlank = false) => {
  const newPage = document.createElement("div");
  newPage.classList.add("page");
  if (isBlank) newPage.classList.add("blank");
  newPage.innerHTML = innerHTML;
  const pagesContainer = getPagesContainer();
  if (index >= pageFlip.getPageCount()) pagesContainer.appendChild(newPage);
  else pagesContainer.insertBefore(newPage, pagesContainer.children[index]);
  updateBook();
};

const removePage = (index) => {
  const pages = getPagesContainer();
  const page = pages.children[index];
  if (!page) return;
  pages.removeChild(page);
  updateBook();
};

// the last page needs to have an odd index or else it wont be a cover
const offsetLastPage = () => {
  const backCoverIndex = getMainPageIndex("back");
  if (backCoverIndex % 2 === 1) return; // already odd, no need to offset
  const pages = pageFlip.getPageCollection();
  if (pages.length >= 2 && pages[pages.length - 2].classList.contains("blank")) {
    // if the penultimate page is blank, we can remove it
    removePage(backCoverIndex - 1);
  } else {
    // otherwise, we need to create a new blank page before the last page
    console.log("Creating new blank page: ", backCoverIndex);
    addPage(backCoverIndex, "blank", true);
  }
};

const hideAllRibbons = () => {
  for (const container of [leftRibbonsContainer, rightRibbonsContainer]) {
    for (const pageName of mainPageNames) {
      const ribbon = container.querySelector(`.ribbon-${pageName}`);
      if (ribbon) ribbon.hidden = true;
    }
  }
};

const updateRibbons = (currentPageIndex) => {
  hideAllRibbons();
  for (const mainPageName of mainPageNames) {
    const mainPageIndex = getMainPageIndex(mainPageName);
    const leftRibbon = leftRibbonsContainer.querySelector(`.ribbon-${mainPageName}`);
    const rightRibbon = rightRibbonsContainer.querySelector(`.ribbon-${mainPageName}`);
    if (!leftRibbon || !rightRibbon) throw new Error(`Ribbon for main page ${mainPageName} not found`);

    if (mainPageIndex < currentPageIndex) leftRibbon.hidden = false;
    // +1 to account for the page thats directly to the right of current page
    else if (mainPageIndex > currentPageIndex + 1) rightRibbon.hidden = false;
    // special case for the first page, where there is no page directly to the right
    else if (mainPageIndex > currentPageIndex && currentPageIndex === 0) rightRibbon.hidden = false;
  }
};

// listeners
let zoomLevel = 1;
const MIN_Z = 0;
const MAX_Z = 5;
const Z_STEP = 0.005;
window.addEventListener(
  "wheel",
  (e) => {
    // zoom logic
    if (!e.ctrlKey) return;
    e.preventDefault();
    zoomLevel = Math.min(MAX_Z, Math.max(MIN_Z, zoomLevel - e.deltaY * Z_STEP));
    if (zoomLevel >= MAX_Z || zoomLevel <= MIN_Z) return;
    const rect = document.body.getBoundingClientRect();
    const ox = ((e.clientX - rect.left) / rect.width) * 100;
    const oy = ((e.clientY - rect.top) / rect.height) * 100;
    document.body.style.transformOrigin = `${ox}% ${oy}%`;
    document.body.style.transform = `scale(${zoomLevel})`;
  },
  { passive: false }
);

pageFlip.on("flip", (e) => updateRibbons(e.data));

document.addEventListener("DOMContentLoaded", () => {
  updateRibbons(0);
  offsetLastPage();
  updateBook();
});
