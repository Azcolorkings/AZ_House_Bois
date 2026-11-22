import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin";
import AdminLoginForm from "@/components/AdminLoginForm";

/**
 * Separate admin login page — deliberately looks different from the
 * regular /login page (dark header, "AZ House Bois — Admin") and has
 * no sign-up link, no role picker, and no boi registration anywhere.
 * Signs in through the same credentials auth; non-admin emails are
 * rejected by the form after sign-in. Already-signed-in admins go
 * straight to the dashboard.
 */
export default async function AdminLoginPage() {
  const session = await auth();
  if (session?.user?.email && isAdminEmail(session.user.email)) {
    redirect("/admin");
  }

  return (
    <section className="section">
      <div className="container" style={{ maxWidth: 520 }}>
        <div
          style={{
            background: "#161513",
            color: "#f5c86e",
            borderRadius: 12,
            padding: "20px 24px",
            marginBottom: 20,
          }}
        >
          <h2 style={{ margin: 0, color: "#f5c86e" }}>
            AZ House Bois — Admin
          </h2>
          <p style={{ margin: "8px 0 0", color: "#d8cdb8" }}>
            Admin sign-in only. No account creation here.
          </p>
        </div>
        <AdminLoginForm />
      </div>
    </section>
  );
}
