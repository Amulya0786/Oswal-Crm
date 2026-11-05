export function showToast(message: string) {
  if (typeof document === "undefined" || !message) return;
  let node = document.getElementById("oswal-toast");
  if (!node) {
    node = document.createElement("div");
    node.id = "oswal-toast";
    node.className = "banner bad";
    node.style.position = "fixed";
    node.style.right = "16px";
    node.style.bottom = "16px";
    node.style.zIndex = "80";
    node.style.maxWidth = "420px";
    document.body.appendChild(node);
  }
  node.textContent = message;
}
