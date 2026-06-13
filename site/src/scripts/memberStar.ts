// Member/free star markup for client-rendered search results (owner feedback
// 2026-06-12). Mirrors components/MemberStar.astro — the gold/silver house SVGs.

export function memberStar(members: boolean): string {
  const src = members ? "/star-members.svg" : "/star-free.svg";
  const label = members ? "Members item" : "Free-to-play item";
  return `<img class="member-star" src="${src}" alt="${label}" width="18" height="18">`;
}
