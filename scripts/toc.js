// Change highlighted item in TOC when location changes

(() => {
  if (!document.querySelector(".toc")) {
    return;
  }
  var active = null;
  function setActive(name) {
    if (name === active) {
      return;
    }
    active = name;
    var items = document.querySelectorAll(".toc a");
    for (let item of items) {
      if (item.getAttribute("href") === name) {
        item.classList.add("active");
      } else {
        item.classList.remove("active");
      }
    }
  }
  let menu_bar_height = document.querySelector(".menu-bar").offsetHeight;
  let lowest = null;
  for (let item of document.querySelectorAll(".content main a")) {
    if (item.parentElement.id === "") {
      continue;
    }
    let rect = item.getBoundingClientRect();
    if (
      rect.top < menu_bar_height + 140 &&
      (lowest === null || rect.top > lowest.getBoundingClientRect().top)
    ) {
      lowest = item;
    }
  }
  if (lowest !== null) {
    setActive("#" + lowest.parentElement.id);
  }

  window.addEventListener("hashchange", function () {
    var hash = window.location.hash;
    setActive(hash);
  });

  let intersection_observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          setActive("#" + entry.target.parentElement.id);
        }
      });
    },
    {
      rootMargin: `-${menu_bar_height}px 0px -75% 0px`,
    }
  );
  for (let item of document.querySelectorAll(".content main a")) {
    intersection_observer.observe(item);
  }
})();
