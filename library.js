(function () {
  var search = document.getElementById("library-search");
  var category = document.getElementById("library-category");
  var entries = Array.from(document.querySelectorAll(".library-entry"));
  var count = document.getElementById("library-count");
  var empty = document.getElementById("library-empty");
  if (!search || !category || !count || !empty) return;

  function filterEntries() {
    var query = search.value.trim().toLocaleLowerCase();
    var selectedCategory = category.value;
    var visible = 0;
    entries.forEach(function (entry) {
      var matchesQuery = entry.textContent.toLocaleLowerCase().includes(query);
      var matchesCategory = selectedCategory === "all" || entry.dataset.category === selectedCategory;
      var show = matchesQuery && matchesCategory;
      entry.hidden = !show;
      if (show) visible += 1;
    });
    count.textContent = "Showing " + visible + " of " + entries.length + " topics.";
    empty.hidden = visible > 0;
  }

  search.addEventListener("input", filterEntries);
  category.addEventListener("change", filterEntries);
  filterEntries();
})();
