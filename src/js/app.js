import { PageFlip } from "page-flip"; // docs: https://nodlik.github.io/StPageFlip/docs/classes/pageflip.html

// global variables
const pageSizeRatio = { width: 778, height: 1080 };
const ribbonContainerSizeRatio = { width: 12, height: 48 };
const ribbonSizeRatio = { width: 12, height: 6 };
const book = document.getElementById("book");
const leftRibbonsContainer = document.getElementById("left-ribbons");
const rightRibbonsContainer = document.getElementById("right-ribbons");
const mainPageCodes = ["front", "map", "album", "stats", "back"];
let pageFlip;

// functions
const getSizes = () => {
  // page
  const vw = document.documentElement.clientWidth;
  const vh = document.documentElement.clientHeight;
  const scaleByWidth = (0.7 * vw) / (2 * pageSizeRatio.width);
  const scaleByHeight = (0.9 * vh) / pageSizeRatio.height;
  const scale = Math.min(scaleByHeight, scaleByWidth);
  const pageWidth = pageSizeRatio.width * scale;
  const pageHeight = pageSizeRatio.height * scale;
  // ribbon container
  const ribbonContainerHeight = pageHeight; // same height as the page
  const ribbonContainerWidth =
    (ribbonContainerSizeRatio.width * ribbonContainerHeight) / ribbonContainerSizeRatio.height;
  // ribbon
  const ribbonWidth = ribbonContainerWidth; // same width as its container
  const ribbonHeight = (ribbonSizeRatio.height * ribbonWidth) / ribbonSizeRatio.width;

  const sizes = {
    page: { width: pageWidth, height: pageHeight },
    ribbonContainer: { width: ribbonContainerWidth, height: ribbonContainerHeight },
    ribbon: { width: ribbonWidth, height: ribbonHeight },
  };
  return sizes;
};

const loadBook = ({ width, height }) => {
  pageFlip = new PageFlip(book, {
    width: width,
    height: height,
    size: "fixed",
    minShadowOpacity: 0.2,
    maxShadowOpacity: 0.6,
    showCover: true,
    mobileScrollSupport: false,
    usePortrait: false,
  });
  pageFlip.loadFromHTML(document.querySelectorAll(".page"));
  pageFlip.on("flip", (e) => {
    updateRibbons(e.data);
  });
};

const resizeRibbonContainers = ({ width, height }) => {
  leftRibbonsContainer.style.height = `${height}px`;
  rightRibbonsContainer.style.height = `${height}px`;
};

const resizeRibbons = ({ width, height }) => {
  for (const ribbon of document.querySelectorAll(".ribbon")) {
    ribbon.style.width = `${width}px`;
    ribbon.style.height = `${height}px`;
  }
};

const getPagesContainer = () => {
  return book.querySelector(".page").parentNode;
};

const getMainPageIndex = (pageCode) => {
  if (!mainPageCodes.includes(pageCode)) throw new Error(`Unknown main page code: ${pageCode}`);
  const pages = Array.from(document.querySelectorAll(".page"));
  const page = pages.find((p) => p.id === `${pageCode}-main-page`);
  if (!page) throw new Error(`Main page ${pageCode} not found`);
  return pages.indexOf(page);
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
  offsetLastPage(); // ensure the last page is always a cover
  updateBook();
};

const removePage = (index) => {
  const pages = getPagesContainer();
  const page = pages.children[index];
  if (!page) return;
  pages.removeChild(page);
  offsetLastPage(); // ensure the last page is always a cover
  updateBook();
};

// the last page needs to have an odd index or else it wont be a cover
const offsetLastPage = () => {
  const backCoverIndex = getMainPageIndex("back");
  if (backCoverIndex % 2 === 1) return; // already odd, no need to offset
  const pages = pageFlip.getPageCollection();
  // if the penultimate page is blank, we can remove it
  if (pages.length >= 2 && pages[pages.length - 2].classList.contains("blank"))
    removePage(backCoverIndex - 1);
  // otherwise, we need to create a new blank page before the last page
  else addPage(backCoverIndex, "blank", true);
};

const hideAllRibbons = () => {
  for (const container of [leftRibbonsContainer, rightRibbonsContainer]) {
    for (const code of mainPageCodes) {
      const ribbon = container.querySelector(`.ribbon-${code}`);
      if (ribbon) ribbon.hidden = true;
    }
  }
};

const updateRibbons = (currentPageIndex) => {
  hideAllRibbons();
  for (const code of mainPageCodes) {
    const mainPageIndex = getMainPageIndex(code);
    const leftRibbon = leftRibbonsContainer.querySelector(`.ribbon-${code}`);
    const rightRibbon = rightRibbonsContainer.querySelector(`.ribbon-${code}`);
    if (!leftRibbon || !rightRibbon) throw new Error(`Ribbon for main page ${code} not found`);

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

for (const ribbonButton of document.querySelectorAll(".ribbon")) {
  ribbonButton.addEventListener("click", (e) => {
    e.preventDefault();
    const pageCode = e.currentTarget.value;
    const pageIndex = getMainPageIndex(pageCode);
    pageFlip.flip(pageIndex);
  });
}

document.addEventListener("DOMContentLoaded", () => {
  const sizes = getSizes();
  loadBook(sizes.page);
  resizeRibbonContainers(sizes.ribbonContainer);
  resizeRibbons(sizes.ribbon);
  updateRibbons(pageFlip.getCurrentPageIndex());
  offsetLastPage();
  updateBook();
});
