import { redirect } from "next/navigation";

/** `/admin` has no dashboard of its own yet, so it opens the product list. */
export default function AdminIndexPage() {
  redirect("/admin/products");
}
