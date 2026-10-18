import { redirect } from "next/navigation";

export const metadata = {
  title: "Account",
  description: "Account has moved to Profile.",
};

export default function AccountPage() {
  redirect("/profile");
}
