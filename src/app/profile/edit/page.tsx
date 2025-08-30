import { redirect } from "next/navigation";
import { auth } from "@/server/auth";
import { api } from "@/trpc/server";
import { EditProfileForm } from "@/app/_components/edit-profile-form";

export const metadata = {
  title: "Edit Profile",
};

export default async function EditProfilePage() {
  const session = await auth();
  if (!session) redirect("/auth");

  const data = await api.profile.get();

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-4 text-xl font-semibold">Edit Profile</h1>
      <div className="card p-5">
        <EditProfileForm
          defaultName={data.name ?? session.user?.name ?? ""}
          defaultBio={data.bio ?? ""}
          defaultLocation={data.location ?? ""}
        />
      </div>
    </div>
  );
}
