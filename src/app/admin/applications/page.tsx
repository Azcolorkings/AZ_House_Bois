import Link from "next/link";
import { auth } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin";
import { listApplications } from "@/lib/db";
import { decryptSecret, maskSsn } from "@/lib/crypto";
import AdminApplicationList from "@/components/AdminApplicationList";

export default async function AdminApplicationsPage() {
  const session = await auth();

  if (!session?.user?.email || !isAdminEmail(session.user.email)) {
    return (
      <section className="section">
        <div className="container" style={{ maxWidth: 640 }}>
          <h2>Admin</h2>
          <p>
            This page is for the site admin only.{" "}
            <Link href="/dashboard">Back to your dashboard</Link>.
          </p>
        </div>
      </section>
    );
  }

  const apps = await listApplications();
  const view = apps.map((a) => {
    let ssn = "";
    try {
      ssn = decryptSecret(a.ssn_encrypted);
    } catch {
      ssn = "";
    }
    return {
      id: a.id,
      email: a.email,
      legal_name: a.legal_name,
      dob: a.dob,
      address: a.address,
      phone: a.phone,
      ssn,
      ssn_masked: maskSsn(ssn),
      emergency_contact_name: a.emergency_contact_name,
      emergency_contact_phone: a.emergency_contact_phone,
      experience: a.experience,
      availability: a.availability,
      service_areas: a.service_areas,
      photo_data: a.photo_data,
      id_upload_data: a.id_upload_data,
      agreement_text: a.agreement_text,
      agreement_signature: a.agreement_signature,
      agreement_signed_at: a.agreement_signed_at,
      status: a.status,
      reviewed_at: a.reviewed_at,
      reviewed_by: a.reviewed_by,
      created_at: a.created_at,
    };
  });

  const pending = view.filter((a) => a.status === "pending").length;
  const approved = view.filter((a) => a.status === "approved").length;
  const denied = view.filter((a) => a.status === "denied").length;

  return (
    <section className="section">
      <div className="container" style={{ maxWidth: 860 }}>
        <h2>Cleaner applications</h2>
        <p className="muted">
          Review each application, then approve or deny it. A cleaner can only
          pay the $20/month listing fee and post a listing after you approve
          them. Denied cleaners can apply again.
        </p>
        <p>
          <span className="pill">{pending} pending</span>{" "}
          <span className="pill">{approved} approved</span>{" "}
          <span className="pill">{denied} denied</span>
        </p>
        <p className="small muted">
          <Link href="/admin/bookings">All bookings →</Link>
        </p>
        <p className="small muted">
          SSNs shown here are decrypted for you because you need them for
          1099 filing. Never share or screenshot them.
        </p>
        <div style={{ marginTop: 20 }}>
          <AdminApplicationList applications={view} />
        </div>
      </div>
    </section>
  );
}
