// Renders the consultation recommendation above the gauge when the user arrives
// from the bell (spec §5: every consultation ends on the item page, recommendation
// above the figures). Reads the hash `#consulted=<tolerance>-<side>-<price>`.

export function renderConsulted(): void {
  const panel = document.getElementById("consulted-panel");
  if (!panel) return;
  const m = location.hash.match(/consulted=(instant|hours|patient)-(buy|sell)-(\d+)/);
  if (!m) return;
  const [, tolerance, side, priceStr] = m;
  const price = Number(priceStr).toLocaleString("en-US");
  const verb = side === "buy" ? "Place a buy offer at" : "Place a sell offer at";
  const when =
    tolerance === "instant" ? "for an immediate fill" : tolerance === "hours" ? "for a fill within the day" : "and let it rest a day or three";
  panel.hidden = false;
  panel.innerHTML = `<p class="rec-line">${verb} <strong>${price} gp</strong> — ${when}.</p>` +
    `<p class="small muted">My arithmetic, set above your own figures so you may check it.</p>`;
  panel.scrollIntoView({ behavior: "smooth", block: "center" });
}
