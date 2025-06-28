import { PageFlip } from "page-flip";

// constants
const book = document.getElementById("book");
const pageWidthPixels = 440;
const pageHeightPixels = 570;
const mainPages = { front: 0, map: 1, album: 2, stats: 3, back: 4 };
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
  // increment all page indices after the new page
  for (const key in mainPages) if (mainPages[key] >= index) mainPages[key] += 1;
  updateBook();
};

const removePage = (index) => {
  const pages = getPagesContainer();
  const page = pages.children[index];
  if (!page) return;
  pages.removeChild(page);
  // decrement all page indices after the new page
  for (const key in mainPages) if (mainPages[key] > index) mainPages[key] -= 1;
  updateBook();
};

// the last page needs to have an odd index or else it wont be a cover
const offsetLastPage = () => {
  if (mainPages.back % 2 === 1) return; // already odd, no need to offset
  const pages = pageFlip.getPageCollection();
  if (pages.length >= 2 && pages[pages.length - 2].classList.contains("blank")) {
    // if the penultimate page is blank, we can remove it
    removePage(mainPages.back - 1);
  } else {
    // otherwise, we need to create a new blank page before the last page
    console.log("Creating new blank page: ", mainPages.back);
    addPage(mainPages.back, "blank", true);
  }
};

const hideAllRibbons = () => {
  for (const container of [leftRibbonsContainer, rightRibbonsContainer]) {
    for (const pageName in mainPages) {
      const ribbon = container.querySelector(`.ribbon-${pageName}`);
      if (ribbon) ribbon.hidden = true;
    }
  }
};

const updateRibbons = (pageIndex) => {
  hideAllRibbons();
  for (const pageName in mainPages) {
    if (mainPages[pageName] < pageIndex) {
      const leftRibbon = leftRibbonsContainer.querySelector(`.ribbon-${pageName}`);
      if (leftRibbon) leftRibbon.hidden = false;
    } else if (mainPages[pageName] > pageIndex + 1) {
      // +1 to account for the page thats directly to the right of current page
      const rightRibbon = rightRibbonsContainer.querySelector(`.ribbon-${pageName}`);
      if (rightRibbon) rightRibbon.hidden = false;
    } else if (mainPages[pageName] > pageIndex && pageIndex === 0) {
      // special case for the first page, where there is no page directly to the right
      const rightRibbon = rightRibbonsContainer.querySelector(`.ribbon-${pageName}`);
      if (rightRibbon) rightRibbon.hidden = false;
    }
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
