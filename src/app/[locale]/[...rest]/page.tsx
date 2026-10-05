import { notFound } from "next/navigation";

// Any address that matches no page (a typo such as /ajustes): the shop's own
// "page not found", in its language (../not-found.tsx), instead of Next's.
export default function UnknownPage() {
  notFound();
}
